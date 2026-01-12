import { contextBridge, ipcRenderer } from 'electron'

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

const api = {
  openFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),
  loadConfig: (): Promise<ConfigInfo> => ipcRenderer.invoke('config:load'),
  importAndSaveConfig: (): Promise<ImportResult> => ipcRenderer.invoke('config:importAndSave'),
  clearConfig: (): Promise<boolean> => ipcRenderer.invoke('config:clear'),
  writeAuditLog: (entry: AuditLogEntry): Promise<boolean> =>
    ipcRenderer.invoke('auditLog:write', entry),
  readAuditLogs: (): Promise<AuditLogEntry[]> => ipcRenderer.invoke('auditLog:read'),
  clearAuditLogs: (): Promise<boolean> => ipcRenderer.invoke('auditLog:clear')
}

contextBridge.exposeInMainWorld('electronAPI', api)
