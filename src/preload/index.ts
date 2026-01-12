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

const api = {
  openFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),
  loadConfig: (): Promise<ConfigInfo> => ipcRenderer.invoke('config:load'),
  importAndSaveConfig: (): Promise<ImportResult> => ipcRenderer.invoke('config:importAndSave'),
  clearConfig: (): Promise<boolean> => ipcRenderer.invoke('config:clear')
}

contextBridge.exposeInMainWorld('electronAPI', api)
