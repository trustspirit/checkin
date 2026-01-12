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
  action: string
  targetType: string
  targetId: string
  targetName: string
  changes?: Record<string, { from: unknown; to: unknown }>
}

declare global {
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
}

export {}
