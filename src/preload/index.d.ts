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

declare global {
  interface Window {
    electronAPI: {
      openFileDialog: () => Promise<string | null>
      loadConfig: () => Promise<ConfigInfo>
      importAndSaveConfig: () => Promise<ImportResult>
      clearConfig: () => Promise<boolean>
    }
  }
}

export {}
