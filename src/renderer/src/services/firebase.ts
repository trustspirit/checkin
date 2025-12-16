import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  limit
} from 'firebase/firestore'
import type { Participant, Group, Room, CheckInRecord, CSVParticipantRow } from '../types'

// Firebase configuration - Replace with your own config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Collections
const PARTICIPANTS_COLLECTION = 'participants'
const GROUPS_COLLECTION = 'groups'
const ROOMS_COLLECTION = 'rooms'

// Helper to convert Firestore timestamps
const convertTimestamp = (timestamp: Timestamp | Date | undefined): Date => {
  if (!timestamp) return new Date()
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  return timestamp
}

// Participant Services
export const searchParticipants = async (searchTerm: string): Promise<Participant[]> => {
  if (!searchTerm.trim()) return []

  const searchLower = searchTerm.toLowerCase()
  const participantsRef = collection(db, PARTICIPANTS_COLLECTION)
  const snapshot = await getDocs(participantsRef)

  const participants: Participant[] = []
  snapshot.forEach((doc) => {
    const data = doc.data()
    const name = (data.name || '').toLowerCase()
    const email = (data.email || '').toLowerCase()
    const phone = (data.phoneNumber || '').toLowerCase()

    if (name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower)) {
      participants.push({
        id: doc.id,
        ...data,
        checkIns: (data.checkIns || []).map((ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
          ...ci,
          checkInTime: convertTimestamp(ci.checkInTime),
          checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
        })),
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as Participant)
    }
  })

  return participants.slice(0, 10)
}

export const getParticipantById = async (id: string): Promise<Participant | null> => {
  const docRef = doc(db, PARTICIPANTS_COLLECTION, id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return null

  const data = docSnap.data()
  return {
    id: docSnap.id,
    ...data,
    checkIns: (data.checkIns || []).map((ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
      ...ci,
      checkInTime: convertTimestamp(ci.checkInTime),
      checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
    })),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt)
  } as Participant
}

export const getAllParticipants = async (): Promise<Participant[]> => {
  const participantsRef = collection(db, PARTICIPANTS_COLLECTION)
  const q = query(participantsRef, orderBy('name'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      checkIns: (data.checkIns || []).map((ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
        ...ci,
        checkInTime: convertTimestamp(ci.checkInTime),
        checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
      })),
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Participant
  })
}

export const checkInParticipant = async (participantId: string): Promise<CheckInRecord> => {
  const docRef = doc(db, PARTICIPANTS_COLLECTION, participantId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) throw new Error('Participant not found')

  const data = docSnap.data()
  const checkIns: CheckInRecord[] = data.checkIns || []

  const newCheckIn: CheckInRecord = {
    id: `checkin_${Date.now()}`,
    checkInTime: new Date()
  }

  await updateDoc(docRef, {
    checkIns: [...checkIns, { ...newCheckIn, checkInTime: Timestamp.fromDate(newCheckIn.checkInTime) }],
    updatedAt: Timestamp.now()
  })

  return newCheckIn
}

export const checkOutParticipant = async (participantId: string, checkInId: string): Promise<void> => {
  const docRef = doc(db, PARTICIPANTS_COLLECTION, participantId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) throw new Error('Participant not found')

  const data = docSnap.data()
  const checkIns = data.checkIns || []

  const updatedCheckIns = checkIns.map((ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => {
    if (ci.id === checkInId) {
      return { ...ci, checkOutTime: Timestamp.now() }
    }
    return ci
  })

  await updateDoc(docRef, {
    checkIns: updatedCheckIns,
    updatedAt: Timestamp.now()
  })
}

// Group Services
export const getAllGroups = async (): Promise<Group[]> => {
  const groupsRef = collection(db, GROUPS_COLLECTION)
  const q = query(groupsRef, orderBy('name'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Group
  })
}

export const createOrGetGroup = async (groupName: string): Promise<Group> => {
  const groupsRef = collection(db, GROUPS_COLLECTION)
  const q = query(groupsRef, where('name', '==', groupName), limit(1))
  const snapshot = await getDocs(q)

  if (!snapshot.empty) {
    const doc = snapshot.docs[0]
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Group
  }

  const newGroupRef = doc(groupsRef)
  const now = Timestamp.now()
  const newGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp; updatedAt: Timestamp } = {
    name: groupName,
    participantCount: 0,
    createdAt: now,
    updatedAt: now
  }

  await setDoc(newGroupRef, newGroup)

  return {
    id: newGroupRef.id,
    ...newGroup,
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  }
}

export const assignParticipantToGroup = async (participantId: string, groupId: string, groupName: string): Promise<void> => {
  const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId)
  const participantSnap = await getDoc(participantRef)

  if (!participantSnap.exists()) throw new Error('Participant not found')

  const oldGroupId = participantSnap.data().groupId
  const batch = writeBatch(db)

  // Update participant
  batch.update(participantRef, {
    groupId,
    groupName,
    updatedAt: Timestamp.now()
  })

  // Decrement old group count if exists
  if (oldGroupId) {
    const oldGroupRef = doc(db, GROUPS_COLLECTION, oldGroupId)
    batch.update(oldGroupRef, {
      participantCount: increment(-1),
      updatedAt: Timestamp.now()
    })
  }

  // Increment new group count
  const newGroupRef = doc(db, GROUPS_COLLECTION, groupId)
  batch.update(newGroupRef, {
    participantCount: increment(1),
    updatedAt: Timestamp.now()
  })

  await batch.commit()
}

// Room Services
export const getAllRooms = async (): Promise<Room[]> => {
  const roomsRef = collection(db, ROOMS_COLLECTION)
  const q = query(roomsRef, orderBy('roomNumber'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Room
  })
}

export const createOrGetRoom = async (roomNumber: string, maxCapacity: number = 4): Promise<Room> => {
  const roomsRef = collection(db, ROOMS_COLLECTION)
  const q = query(roomsRef, where('roomNumber', '==', roomNumber), limit(1))
  const snapshot = await getDocs(q)

  if (!snapshot.empty) {
    const doc = snapshot.docs[0]
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Room
  }

  const newRoomRef = doc(roomsRef)
  const now = Timestamp.now()
  const newRoom: Omit<Room, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp; updatedAt: Timestamp } = {
    roomNumber,
    maxCapacity,
    currentOccupancy: 0,
    createdAt: now,
    updatedAt: now
  }

  await setDoc(newRoomRef, newRoom)

  return {
    id: newRoomRef.id,
    ...newRoom,
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  }
}

export const assignParticipantToRoom = async (participantId: string, roomId: string, roomNumber: string): Promise<void> => {
  const participantRef = doc(db, PARTICIPANTS_COLLECTION, participantId)
  const participantSnap = await getDoc(participantRef)

  if (!participantSnap.exists()) throw new Error('Participant not found')

  const roomRef = doc(db, ROOMS_COLLECTION, roomId)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) throw new Error('Room not found')

  const roomData = roomSnap.data()
  if (roomData.currentOccupancy >= roomData.maxCapacity) {
    throw new Error('Room is at full capacity')
  }

  const oldRoomId = participantSnap.data().roomId
  const batch = writeBatch(db)

  // Update participant
  batch.update(participantRef, {
    roomId,
    roomNumber,
    updatedAt: Timestamp.now()
  })

  // Decrement old room count if exists
  if (oldRoomId) {
    const oldRoomRef = doc(db, ROOMS_COLLECTION, oldRoomId)
    batch.update(oldRoomRef, {
      currentOccupancy: increment(-1),
      updatedAt: Timestamp.now()
    })
  }

  // Increment new room count
  batch.update(roomRef, {
    currentOccupancy: increment(1),
    updatedAt: Timestamp.now()
  })

  await batch.commit()
}

// CSV Import
export const importParticipantsFromCSV = async (rows: CSVParticipantRow[]): Promise<{ created: number; updated: number }> => {
  let created = 0
  let updated = 0

  const participantsRef = collection(db, PARTICIPANTS_COLLECTION)

  for (const row of rows) {
    if (!row.name || !row.email) continue

    // Check if participant exists by email
    const q = query(participantsRef, where('email', '==', row.email), limit(1))
    const snapshot = await getDocs(q)

    const metadata: Record<string, unknown> = {}
    const knownFields = ['name', 'gender', 'age', 'stake', 'ward', 'phoneNumber', 'email', 'groupName', 'roomNumber']
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
        const groupRef = doc(db, GROUPS_COLLECTION, groupId)
        await updateDoc(groupRef, {
          participantCount: increment(1),
          updatedAt: now
        })
      }

      // Update room count
      if (roomId) {
        const roomRef = doc(db, ROOMS_COLLECTION, roomId)
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
        metadata: Object.keys(metadata).length > 0 ? { ...existingData.metadata, ...metadata } : existingData.metadata,
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

export { db }
