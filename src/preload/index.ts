import { contextBridge, ipcRenderer } from 'electron'

const api = {
  openFileDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile')
}

contextBridge.exposeInMainWorld('electronAPI', api)
