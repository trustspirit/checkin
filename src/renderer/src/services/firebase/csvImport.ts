import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  increment,
  limit
} from 'firebase/firestore'
import type { CSVParticipantRow } from '../../types'
import { getDb, PARTICIPANTS_COLLECTION, GROUPS_COLLECTION, ROOMS_COLLECTION } from './config'
import { createOrGetGroup } from './groups'
import { createOrGetRoom } from './rooms'

export const importParticipantsFromCSV = async (
  rows: CSVParticipantRow[]
): Promise<{ created: number; updated: number }> => {
  let created = 0
  let updated = 0

  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)

  for (const row of rows) {
    if (!row.name || !row.email) continue

    // Check if participant exists by email
    const q = query(participantsRef, where('email', '==', row.email), limit(1))
    const snapshot = await getDocs(q)

    const metadata: Record<string, unknown> = {}
    const knownFields = [
      'name',
      'gender',
      'age',
      'stake',
      'ward',
      'phoneNumber',
      'email',
      'groupName',
      'roomNumber'
    ]
    Object.keys(row).forEach((key) => {
      if (!knownFields.includes(key) && row[key]) {
        metadata[key] = row[key]
      }
    })

    // Handle group
    let groupId: string | undefined
    let groupName: string | undefined
    if (row.groupName) {
      const group = await createOrGetGroup(row.groupName)
      groupId = group.id
      groupName = group.name
    }

    // Handle room
    let roomId: string | undefined
    let roomNumber: string | undefined
    if (row.roomNumber) {
      const room = await createOrGetRoom(row.roomNumber)
      roomId = room.id
      roomNumber = room.roomNumber
    }

    const now = Timestamp.now()

    if (snapshot.empty) {
      // Create new participant
      const newParticipantRef = doc(participantsRef)
      await setDoc(newParticipantRef, {
        name: row.name,
        gender: row.gender || '',
        age: parseInt(row.age) || 0,
        stake: row.stake || '',
        ward: row.ward || '',
        phoneNumber: row.phoneNumber || '',
        email: row.email,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        groupId,
        groupName,
        roomId,
        roomNumber,
        checkIns: [],
        createdAt: now,
        updatedAt: now
      })

      // Update group count
      if (groupId) {
        const groupRef = doc(getDb(), GROUPS_COLLECTION, groupId)
        await updateDoc(groupRef, {
          participantCount: increment(1),
          updatedAt: now
        })
      }

      // Update room count
      if (roomId) {
        const roomRef = doc(getDb(), ROOMS_COLLECTION, roomId)
        await updateDoc(roomRef, {
          currentOccupancy: increment(1),
          updatedAt: now
        })
      }

      created++
    } else {
      // Update existing participant
      const existingDoc = snapshot.docs[0]
      const existingData = existingDoc.data()

      await updateDoc(existingDoc.ref, {
        name: row.name,
        gender: row.gender || existingData.gender,
        age: parseInt(row.age) || existingData.age,
        stake: row.stake || existingData.stake,
        ward: row.ward || existingData.ward,
        phoneNumber: row.phoneNumber || existingData.phoneNumber,
        metadata:
          Object.keys(metadata).length > 0
            ? { ...existingData.metadata, ...metadata }
            : existingData.metadata,
        groupId: groupId || existingData.groupId,
        groupName: groupName || existingData.groupName,
        roomId: roomId || existingData.roomId,
        roomNumber: roomNumber || existingData.roomNumber,
        updatedAt: now
      })

      updated++
    }
  }

  return { created, updated }
}
