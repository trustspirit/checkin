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

interface AuditLogEntry {
  id: string
  timestamp: string
  userName: string
  action: 'create' | 'update' | 'delete' | 'check_in' | 'check_out' | 'assign' | 'import'
  targetType: 'participant' | 'group' | 'room'
  targetId: string
  targetName: string
  changes?: Record<string, { from: unknown; to: unknown }>
}

interface Window {
  electronAPI: {
    openFileDialog: () => Promise<string | null>
    loadConfig: () => Promise<ConfigInfo>
    importAndSaveConfig: () => Promise<ImportResult>
    clearConfig: () => Promise<boolean>
    writeAuditLog: (entry: AuditLogEntry) => Promise<boolean>
    readAuditLogs: () => Promise<AuditLogEntry[]>
    clearAuditLogs: () => Promise<boolean>
  }
}
