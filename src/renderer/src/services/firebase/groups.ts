import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  limit
} from 'firebase/firestore'
import type { Group } from '../../types'
import { getDb, GROUPS_COLLECTION, PARTICIPANTS_COLLECTION, convertTimestamp } from './config'

export const getAllGroups = async (): Promise<Group[]> => {
  const groupsRef = collection(getDb(), GROUPS_COLLECTION)
  const q = query(groupsRef, orderBy('name'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Group
  })
}

export const getGroupById = async (groupId: string): Promise<Group | null> => {
  const groupRef = doc(getDb(), GROUPS_COLLECTION, groupId)
  const groupSnap = await getDoc(groupRef)

  if (!groupSnap.exists()) return null

  const data = groupSnap.data()
  return {
    id: groupSnap.id,
    ...data,
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt)
  } as Group
}

export const createOrGetGroup = async (
  groupName: string,
  expectedCapacity?: number
): Promise<Group> => {
  const groupsRef = collection(getDb(), GROUPS_COLLECTION)
  const q = query(groupsRef, where('name', '==', groupName), limit(1))
  const snapshot = await getDocs(q)

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0]
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Group
  }

  const newGroupRef = doc(groupsRef)
  const now = Timestamp.now()
  const newGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp
    updatedAt: Timestamp
  } = {
    name: groupName,
    participantCount: 0,
    expectedCapacity: expectedCapacity || undefined,
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

export const assignParticipantToGroup = async (
  participantId: string,
  groupId: string,
  groupName: string
): Promise<void> => {
  const participantRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const participantSnap = await getDoc(participantRef)

  if (!participantSnap.exists()) throw new Error('Participant not found')

  const oldGroupId = participantSnap.data().groupId
  const batch = writeBatch(getDb())

  // Update participant
  batch.update(participantRef, {
    groupId,
    groupName,
    updatedAt: Timestamp.now()
  })

  // Decrement old group count if exists
  if (oldGroupId) {
    const oldGroupRef = doc(getDb(), GROUPS_COLLECTION, oldGroupId)
    batch.update(oldGroupRef, {
      participantCount: increment(-1),
      updatedAt: Timestamp.now()
    })
  }

  // Increment new group count
  const newGroupRef = doc(getDb(), GROUPS_COLLECTION, groupId)
  batch.update(newGroupRef, {
    participantCount: increment(1),
    updatedAt: Timestamp.now()
  })

  await batch.commit()
}

export const updateGroup = async (
  groupId: string,
  data: { name?: string; expectedCapacity?: number | null }
): Promise<Group> => {
  const groupRef = doc(getDb(), GROUPS_COLLECTION, groupId)
  const groupSnap = await getDoc(groupRef)

  if (!groupSnap.exists()) throw new Error('Group not found')

  const currentData = groupSnap.data()
  const batch = writeBatch(getDb())

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now()
  }

  if (data.name !== undefined) {
    updateData.name = data.name
  }

  if (data.expectedCapacity !== undefined) {
    updateData.expectedCapacity = data.expectedCapacity
  }

  batch.update(groupRef, updateData)

  if (data.name !== undefined && data.name !== currentData.name) {
    const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
    const q = query(participantsRef, where('groupId', '==', groupId))
    const snapshot = await getDocs(q)

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        groupName: data.name,
        updatedAt: Timestamp.now()
      })
    })
  }

  await batch.commit()

  const updatedSnap = await getDoc(groupRef)
  const updatedData = updatedSnap.data()!

  return {
    id: updatedSnap.id,
    ...updatedData,
    createdAt: convertTimestamp(updatedData.createdAt),
    updatedAt: convertTimestamp(updatedData.updatedAt)
  } as Group
}

export const deleteGroup = async (groupId: string): Promise<void> => {
  const batch = writeBatch(getDb())

  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
  const q = query(participantsRef, where('groupId', '==', groupId))
  const snapshot = await getDocs(q)

  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      groupId: null,
      groupName: null,
      updatedAt: Timestamp.now()
    })
  })

  const groupRef = doc(getDb(), GROUPS_COLLECTION, groupId)
  batch.delete(groupRef)

  await batch.commit()
}
