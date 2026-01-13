/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

interface ConfigInfo {
  config: FirebaseConfig | null
  filePath: string | null
}

interface ImportResult {
  success: boolean
  config?: FirebaseConfig
  filePath?: string
  error?: string
}

interface Window {
  electronAPI: {
    openFileDialog: () => Promise<string | null>
    loadConfig: () => Promise<ConfigInfo>
    importAndSaveConfig: () => Promise<ImportResult>
    clearConfig: () => Promise<boolean>
  }
}
