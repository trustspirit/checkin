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
import type { Room } from '../../types'
import { getDb, ROOMS_COLLECTION, PARTICIPANTS_COLLECTION, convertTimestamp } from './config'

export const getAllRooms = async (): Promise<Room[]> => {
  const roomsRef = collection(getDb(), ROOMS_COLLECTION)
  const q = query(roomsRef, orderBy('roomNumber'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Room
  })
}

export const getRoomById = async (roomId: string): Promise<Room | null> => {
  const roomRef = doc(getDb(), ROOMS_COLLECTION, roomId)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) return null

  const data = roomSnap.data()
  return {
    id: roomSnap.id,
    ...data,
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt)
  } as Room
}

export const createOrGetRoom = async (
  roomNumber: string,
  maxCapacity: number = 4
): Promise<Room> => {
  const roomsRef = collection(getDb(), ROOMS_COLLECTION)
  const q = query(roomsRef, where('roomNumber', '==', roomNumber), limit(1))
  const snapshot = await getDocs(q)

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0]
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Room
  }

  const newRoomRef = doc(roomsRef)
  const now = Timestamp.now()
  const newRoom: Omit<Room, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp
    updatedAt: Timestamp
  } = {
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

export const assignParticipantToRoom = async (
  participantId: string,
  roomId: string,
  roomNumber: string
): Promise<void> => {
  const participantRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const participantSnap = await getDoc(participantRef)

  if (!participantSnap.exists()) throw new Error('Participant not found')

  const roomRef = doc(getDb(), ROOMS_COLLECTION, roomId)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) throw new Error('Room not found')

  const roomData = roomSnap.data()
  if (roomData.currentOccupancy >= roomData.maxCapacity) {
    throw new Error('Room is at full capacity')
  }

  const oldRoomId = participantSnap.data().roomId
  const batch = writeBatch(getDb())

  // Update participant
  batch.update(participantRef, {
    roomId,
    roomNumber,
    updatedAt: Timestamp.now()
  })

  // Decrement old room count if exists
  if (oldRoomId) {
    const oldRoomRef = doc(getDb(), ROOMS_COLLECTION, oldRoomId)
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

export const updateRoom = async (
  roomId: string,
  data: { roomNumber?: string; maxCapacity?: number }
): Promise<Room> => {
  const roomRef = doc(getDb(), ROOMS_COLLECTION, roomId)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) throw new Error('Room not found')

  const currentData = roomSnap.data()
  const batch = writeBatch(getDb())

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now()
  }

  if (data.roomNumber !== undefined) {
    updateData.roomNumber = data.roomNumber
  }
  if (data.maxCapacity !== undefined) {
    if (data.maxCapacity < currentData.currentOccupancy) {
      throw new Error('Capacity cannot be less than current occupancy')
    }
    updateData.maxCapacity = data.maxCapacity
  }

  batch.update(roomRef, updateData)

  if (data.roomNumber !== undefined && data.roomNumber !== currentData.roomNumber) {
    const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
    const q = query(participantsRef, where('roomId', '==', roomId))
    const snapshot = await getDocs(q)

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        roomNumber: data.roomNumber,
        updatedAt: Timestamp.now()
      })
    })
  }

  await batch.commit()

  const updatedSnap = await getDoc(roomRef)
  const updatedData = updatedSnap.data()!

  return {
    id: updatedSnap.id,
    ...updatedData,
    createdAt: convertTimestamp(updatedData.createdAt),
    updatedAt: convertTimestamp(updatedData.updatedAt)
  } as Room
}

export const deleteRoom = async (roomId: string): Promise<void> => {
  const batch = writeBatch(getDb())

  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
  const q = query(participantsRef, where('roomId', '==', roomId))
  const snapshot = await getDocs(q)

  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      roomId: null,
      roomNumber: null,
      updatedAt: Timestamp.now()
    })
  })

  const roomRef = doc(getDb(), ROOMS_COLLECTION, roomId)
  batch.delete(roomRef)

  await batch.commit()
}
