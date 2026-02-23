import { initializeApp } from 'firebase/app'
import { getFirestore, Timestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.projectId
}

export const getDb = () => db

// Collection names
export const PARTICIPANTS_COLLECTION = 'participants'
export const GROUPS_COLLECTION = 'groups'
export const ROOMS_COLLECTION = 'rooms'
export const USERS_COLLECTION = 'users'
export const SCHEDULES_COLLECTION = 'schedules'

// Helper to convert Firestore timestamps
export const convertTimestamp = (timestamp: Timestamp | Date | undefined): Date => {
  if (!timestamp) return new Date()
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  return timestamp
}
