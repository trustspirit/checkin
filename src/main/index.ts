import { app, shell, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'

const getConfigPathStorePath = () => join(app.getPath('userData'), 'config-path.txt')
const getAuditLogPath = () => join(app.getPath('userData'), 'audit-log.json')

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

function loadStoredConfigPath(): string | null {
  try {
    const storePath = getConfigPathStorePath()
    if (fs.existsSync(storePath)) {
      return fs.readFileSync(storePath, 'utf-8').trim()
    }
  } catch {
    return null
  }
  return null
}

function saveConfigPath(filePath: string): void {
  try {
    const storePath = getConfigPathStorePath()
    fs.writeFileSync(storePath, filePath, 'utf-8')
  } catch {
    console.error('Failed to save config path')
  }
}

function loadConfigFromPath(filePath: string): FirebaseConfig | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const config = JSON.parse(content) as FirebaseConfig
      if (config.apiKey && config.projectId) {
        return config
      }
    }
  } catch {
    return null
  }
  return null
}

function loadConfig(): ConfigInfo {
  const storedPath = loadStoredConfigPath()
  if (storedPath) {
    const config = loadConfigFromPath(storedPath)
    if (config) {
      return { config, filePath: storedPath }
    }
  }
  return { config: null, filePath: null }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.checkin')

  if (process.platform === 'darwin') {
    const iconPath = join(__dirname, '../../resources/icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      app.dock?.setIcon(icon)
    }
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return content
  })

  ipcMain.handle('config:load', () => {
    return loadConfig()
  })

  ipcMain.handle('config:importAndSave', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No file selected' }
    }

    const filePath = result.filePaths[0]
    const config = loadConfigFromPath(filePath)

    if (!config) {
      return { success: false, error: 'Invalid config file. Must contain apiKey and projectId.' }
    }

    saveConfigPath(filePath)
    return { success: true, config, filePath }
  })

  ipcMain.handle('config:clear', () => {
    try {
      const storePath = getConfigPathStorePath()
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath)
      }
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('auditLog:write', (_event, entry: AuditLogEntry) => {
    try {
      const logPath = getAuditLogPath()
      let logs: AuditLogEntry[] = []

      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8')
        logs = JSON.parse(content)
      }

      logs.push(entry)
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('auditLog:read', () => {
    try {
      const logPath = getAuditLogPath()
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf-8')
        return JSON.parse(content) as AuditLogEntry[]
      }
      return []
    } catch {
      return []
    }
  })

  ipcMain.handle('auditLog:clear', () => {
    try {
      const logPath = getAuditLogPath()
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath)
      }
      return true
    } catch {
      return false
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
