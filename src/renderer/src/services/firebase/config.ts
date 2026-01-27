import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore, Timestamp } from 'firebase/firestore'

export interface FirebaseConfig {
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

export const getDb = (): Firestore => {
  if (!db) {
    throw new Error('Firebase is not configured. Please set up your database in Settings.')
  }
  return db
}

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
