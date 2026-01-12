import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  limit,
  Firestore,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore'
import type { Participant, Group, Room, CheckInRecord, CSVParticipantRow } from '../types'

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

let app: FirebaseApp | null = null
let db: Firestore | null = null

const getDefaultConfig = (): FirebaseConfig => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
})

const initializeFirebaseApp = async (): Promise<void> => {
  let config: FirebaseConfig | null = null

  try {
    const configInfo = await window.electronAPI.loadConfig()
    config = configInfo.config
  } catch {
    console.log('Could not load config from storage, using env defaults')
  }

  if (!config || !config.projectId) {
    config = getDefaultConfig()
  }

  if (config.projectId) {
    app = initializeApp(config)
    db = getFirestore(app)
  }
}

export const reinitializeFirebase = async (config: FirebaseConfig): Promise<void> => {
  if (app) {
    await deleteApp(app)
  }
  app = initializeApp(config)
  db = getFirestore(app)
}

export const isFirebaseConfigured = (): boolean => {
  return db !== null
}

initializeFirebaseApp()

const getDb = (): Firestore => {
  if (!db) {
    throw new Error('Firebase is not configured. Please set up your database in Settings.')
  }
  return db
}

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
  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
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
        checkIns: (data.checkIns || []).map(
          (ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
            ...ci,
            checkInTime: convertTimestamp(ci.checkInTime),
            checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
          })
        ),
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as Participant)
    }
  })

  return participants.slice(0, 10)
}

export const getParticipantById = async (id: string): Promise<Participant | null> => {
  const docRef = doc(getDb(), PARTICIPANTS_COLLECTION, id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return null

  const data = docSnap.data()
  return {
    id: docSnap.id,
    ...data,
    checkIns: (data.checkIns || []).map(
      (ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
        ...ci,
        checkInTime: convertTimestamp(ci.checkInTime),
        checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
      })
    ),
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt)
  } as Participant
}

export const getAllParticipants = async (): Promise<Participant[]> => {
  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
  const q = query(participantsRef, orderBy('name'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      ...data,
      checkIns: (data.checkIns || []).map(
        (ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
          ...ci,
          checkInTime: convertTimestamp(ci.checkInTime),
          checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
        })
      ),
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as Participant
  })
}

export interface CreateParticipantData {
  name: string
  email: string
  gender?: string
  age?: number
  stake?: string
  ward?: string
  phoneNumber?: string
  groupId?: string
  groupName?: string
  roomId?: string
  roomNumber?: string
}

export interface UpdateParticipantData {
  name?: string
  email?: string
  gender?: string
  age?: number
  stake?: string
  ward?: string
  phoneNumber?: string
}

export interface UpdateParticipantData {
  name?: string
  email?: string
  gender?: string
  age?: number
  stake?: string
  ward?: string
  phoneNumber?: string
}

export const addParticipant = async (data: CreateParticipantData): Promise<Participant> => {
  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)

  // Check if email already exists
  const q = query(participantsRef, where('email', '==', data.email), limit(1))
  const snapshot = await getDocs(q)

  if (!snapshot.empty) {
    throw new Error('A participant with this email already exists')
  }

  const now = Timestamp.now()
  const newParticipantRef = doc(participantsRef)

  const participantData = {
    name: data.name,
    email: data.email,
    gender: data.gender || '',
    age: data.age || 0,
    stake: data.stake || '',
    ward: data.ward || '',
    phoneNumber: data.phoneNumber || '',
    groupId: data.groupId || null,
    groupName: data.groupName || null,
    roomId: data.roomId || null,
    roomNumber: data.roomNumber || null,
    checkIns: [],
    createdAt: now,
    updatedAt: now
  }

  await setDoc(newParticipantRef, participantData)

  // Update group count if assigned
  if (data.groupId) {
    const groupRef = doc(getDb(), GROUPS_COLLECTION, data.groupId)
    await updateDoc(groupRef, {
      participantCount: increment(1),
      updatedAt: now
    })
  }

  // Update room count if assigned
  if (data.roomId) {
    const roomRef = doc(getDb(), ROOMS_COLLECTION, data.roomId)
    await updateDoc(roomRef, {
      currentOccupancy: increment(1),
      updatedAt: now
    })
  }

  return {
    id: newParticipantRef.id,
    ...participantData,
    groupId: data.groupId,
    groupName: data.groupName,
    roomId: data.roomId,
    roomNumber: data.roomNumber,
    checkIns: [],
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  }
}

export interface UpdateParticipantData {
  name?: string
  email?: string
  gender?: string
  age?: number
  stake?: string
  ward?: string
  phoneNumber?: string
}

export const updateParticipant = async (
  participantId: string,
  data: UpdateParticipantData
): Promise<Participant> => {
  const docRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) throw new Error('Participant not found')

  const currentData = docSnap.data()

  if (data.email && data.email !== currentData.email) {
    const emailQuery = query(
      collection(getDb(), PARTICIPANTS_COLLECTION),
      where('email', '==', data.email),
      limit(1)
    )
    const emailSnapshot = await getDocs(emailQuery)
    if (!emailSnapshot.empty) {
      throw new Error('Email already exists')
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now()
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.email !== undefined) updateData.email = data.email
  if (data.gender !== undefined) updateData.gender = data.gender
  if (data.age !== undefined) updateData.age = data.age
  if (data.stake !== undefined) updateData.stake = data.stake
  if (data.ward !== undefined) updateData.ward = data.ward
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber

  await updateDoc(docRef, updateData)

  const updatedSnap = await getDoc(docRef)
  const updatedData = updatedSnap.data()!

  return {
    id: updatedSnap.id,
    ...updatedData,
    checkIns: (updatedData.checkIns || []).map(
      (ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
        id: ci.id,
        checkInTime: ci.checkInTime.toDate(),
        checkOutTime: ci.checkOutTime?.toDate()
      })
    ),
    createdAt: convertTimestamp(updatedData.createdAt),
    updatedAt: convertTimestamp(updatedData.updatedAt)
  } as Participant
}

export const checkInParticipant = async (participantId: string): Promise<CheckInRecord> => {
  const docRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) throw new Error('Participant not found')

  const data = docSnap.data()
  const checkIns: CheckInRecord[] = data.checkIns || []

  const newCheckIn: CheckInRecord = {
    id: `checkin_${Date.now()}`,
    checkInTime: new Date()
  }

  await updateDoc(docRef, {
    checkIns: [
      ...checkIns,
      { ...newCheckIn, checkInTime: Timestamp.fromDate(newCheckIn.checkInTime) }
    ],
    updatedAt: Timestamp.now()
  })

  return newCheckIn
}

export const checkOutParticipant = async (
  participantId: string,
  checkInId: string
): Promise<void> => {
  const docRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) throw new Error('Participant not found')

  const data = docSnap.data()
  const checkIns = data.checkIns || []

  const updatedCheckIns = checkIns.map(
    (ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => {
      if (ci.id === checkInId) {
        return { ...ci, checkOutTime: Timestamp.now() }
      }
      return ci
    }
  )

  await updateDoc(docRef, {
    checkIns: updatedCheckIns,
    updatedAt: Timestamp.now()
  })
}

// Group Services
export const getAllGroups = async (): Promise<Group[]> => {
  const groupsRef = collection(getDb(), GROUPS_COLLECTION)
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

export const createOrGetGroup = async (
  groupName: string,
  expectedCapacity?: number
): Promise<Group> => {
  const groupsRef = collection(getDb(), GROUPS_COLLECTION)
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

// Room Services
export const getAllRooms = async (): Promise<Room[]> => {
  const roomsRef = collection(getDb(), ROOMS_COLLECTION)
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

export const createOrGetRoom = async (
  roomNumber: string,
  maxCapacity: number = 4
): Promise<Room> => {
  const roomsRef = collection(getDb(), ROOMS_COLLECTION)
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

// CSV Import
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

export const moveParticipantsToRoom = async (
  participantIds: string[],
  targetRoomId: string,
  targetRoomNumber: string
): Promise<void> => {
  if (participantIds.length === 0) return

  const roomRef = doc(getDb(), ROOMS_COLLECTION, targetRoomId)
  const roomSnap = await getDoc(roomRef)

  if (!roomSnap.exists()) throw new Error('Target room not found')

  const roomData = roomSnap.data()
  const availableSpace = roomData.maxCapacity - roomData.currentOccupancy

  const participantRefs = await Promise.all(
    participantIds.map(async (id) => {
      const ref = doc(getDb(), PARTICIPANTS_COLLECTION, id)
      const snap = await getDoc(ref)
      return { ref, snap, id }
    })
  )

  const validParticipants = participantRefs.filter((p) => p.snap.exists())
  const movingToNewRoom = validParticipants.filter((p) => p.snap.data()?.roomId !== targetRoomId)

  if (movingToNewRoom.length > availableSpace) {
    throw new Error(
      `Room capacity exceeded. Available: ${availableSpace}, Trying to move: ${movingToNewRoom.length}`
    )
  }

  const batch = writeBatch(getDb())
  const roomCountChanges: Record<string, number> = {}

  for (const { ref, snap } of validParticipants) {
    const data = snap.data()!
    const oldRoomId = data.roomId

    if (oldRoomId === targetRoomId) continue

    batch.update(ref, {
      roomId: targetRoomId,
      roomNumber: targetRoomNumber,
      updatedAt: Timestamp.now()
    })

    if (oldRoomId) {
      roomCountChanges[oldRoomId] = (roomCountChanges[oldRoomId] || 0) - 1
    }
    roomCountChanges[targetRoomId] = (roomCountChanges[targetRoomId] || 0) + 1
  }

  for (const [roomId, change] of Object.entries(roomCountChanges)) {
    const ref = doc(getDb(), ROOMS_COLLECTION, roomId)
    batch.update(ref, {
      currentOccupancy: increment(change),
      updatedAt: Timestamp.now()
    })
  }

  await batch.commit()
}

export const moveParticipantsToGroup = async (
  participantIds: string[],
  targetGroupId: string,
  targetGroupName: string
): Promise<void> => {
  if (participantIds.length === 0) return

  const groupRef = doc(getDb(), GROUPS_COLLECTION, targetGroupId)
  const groupSnap = await getDoc(groupRef)

  if (!groupSnap.exists()) throw new Error('Target group not found')

  const participantRefs = await Promise.all(
    participantIds.map(async (id) => {
      const ref = doc(getDb(), PARTICIPANTS_COLLECTION, id)
      const snap = await getDoc(ref)
      return { ref, snap, id }
    })
  )

  const validParticipants = participantRefs.filter((p) => p.snap.exists())

  const batch = writeBatch(getDb())
  const groupCountChanges: Record<string, number> = {}

  for (const { ref, snap } of validParticipants) {
    const data = snap.data()!
    const oldGroupId = data.groupId

    if (oldGroupId === targetGroupId) continue

    batch.update(ref, {
      groupId: targetGroupId,
      groupName: targetGroupName,
      updatedAt: Timestamp.now()
    })

    if (oldGroupId) {
      groupCountChanges[oldGroupId] = (groupCountChanges[oldGroupId] || 0) - 1
    }
    groupCountChanges[targetGroupId] = (groupCountChanges[targetGroupId] || 0) + 1
  }

  for (const [groupId, change] of Object.entries(groupCountChanges)) {
    const ref = doc(getDb(), GROUPS_COLLECTION, groupId)
    batch.update(ref, {
      participantCount: increment(change),
      updatedAt: Timestamp.now()
    })
  }

  await batch.commit()
}

export type DataListener<T> = (data: T[]) => void

export const subscribeToParticipants = (onData: DataListener<Participant>): Unsubscribe => {
  const participantsRef = collection(getDb(), PARTICIPANTS_COLLECTION)
  const q = query(participantsRef, orderBy('name'))

  return onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        checkIns: (data.checkIns || []).map(
          (ci: { id: string; checkInTime: Timestamp; checkOutTime?: Timestamp }) => ({
            ...ci,
            checkInTime: convertTimestamp(ci.checkInTime),
            checkOutTime: ci.checkOutTime ? convertTimestamp(ci.checkOutTime) : undefined
          })
        ),
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as Participant
    })
    onData(participants)
  })
}

export const subscribeToGroups = (onData: DataListener<Group>): Unsubscribe => {
  const groupsRef = collection(getDb(), GROUPS_COLLECTION)
  const q = query(groupsRef, orderBy('name'))

  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as Group
    })
    onData(groups)
  })
}

export const subscribeToRooms = (onData: DataListener<Room>): Unsubscribe => {
  const roomsRef = collection(getDb(), ROOMS_COLLECTION)
  const q = query(roomsRef, orderBy('roomNumber'))

  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as Room
    })
    onData(rooms)
  })
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

export const removeParticipantFromGroup = async (participantId: string): Promise<void> => {
  const participantRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const participantSnap = await getDoc(participantRef)

  if (!participantSnap.exists()) throw new Error('Participant not found')

  const data = participantSnap.data()
  const groupId = data.groupId

  if (!groupId) return

  const batch = writeBatch(getDb())

  batch.update(participantRef, {
    groupId: null,
    groupName: null,
    updatedAt: Timestamp.now()
  })

  const groupRef = doc(getDb(), GROUPS_COLLECTION, groupId)
  batch.update(groupRef, {
    participantCount: increment(-1),
    updatedAt: Timestamp.now()
  })

  await batch.commit()
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

export const removeParticipantFromRoom = async (participantId: string): Promise<void> => {
  const participantRef = doc(getDb(), PARTICIPANTS_COLLECTION, participantId)
  const participantSnap = await getDoc(participantRef)

  if (!participantSnap.exists()) throw new Error('Participant not found')

  const data = participantSnap.data()
  const roomId = data.roomId

  if (!roomId) return

  const batch = writeBatch(getDb())

  batch.update(participantRef, {
    roomId: null,
    roomNumber: null,
    updatedAt: Timestamp.now()
  })

  const roomRef = doc(getDb(), ROOMS_COLLECTION, roomId)
  batch.update(roomRef, {
    currentOccupancy: increment(-1),
    updatedAt: Timestamp.now()
  })

  await batch.commit()
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

export { getDb }
