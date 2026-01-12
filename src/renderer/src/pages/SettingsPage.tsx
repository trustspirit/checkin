import React, { useState, useEffect } from 'react'
import { reinitializeFirebase } from '../services/firebase'

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

function SettingsPage(): React.ReactElement {
  const [configPath, setConfigPath] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadCurrentConfig()
  }, [])

  const loadCurrentConfig = async () => {
    setIsLoading(true)
    try {
      const configInfo = await window.electronAPI.loadConfig()
      if (configInfo.config && configInfo.filePath) {
        setConfigPath(configInfo.filePath)
        setIsConfigured(true)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    setMessage(null)
    try {
      const result = await window.electronAPI.importAndSaveConfig()
      if (result.success && result.config && result.filePath) {
        await reinitializeFirebase(result.config)
        setConfigPath(result.filePath)
        setIsConfigured(true)
        setMessage({
          type: 'success',
          text: 'Configuration loaded successfully! Firebase connected.'
        })
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to import configuration file'
        })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error importing configuration file' })
    }
  }

  const handleClearConfig = async () => {
    try {
      await window.electronAPI.clearConfig()
      setConfigPath(null)
      setIsConfigured(false)
      setMessage({
        type: 'success',
        text: 'Configuration cleared. Please import a new configuration file.'
      })
    } catch {
      setMessage({ type: 'error', text: 'Failed to clear configuration' })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Settings</h1>
        <p className="text-slate-500">Configure your Firebase database connection</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Firebase Configuration</h2>

        {isConfigured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800">Connected</p>
                <p className="text-sm text-green-600 truncate" title={configPath || ''}>
                  {configPath}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Change Configuration
              </button>
              <button
                onClick={handleClearConfig}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
              >
                Clear Configuration
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-amber-800">Not Configured</p>
                <p className="text-sm text-amber-600">
                  Please import a Firebase configuration JSON file
                </p>
              </div>
            </div>

            <button
              onClick={handleImport}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Import Configuration File
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 bg-slate-50 rounded-lg p-6">
        <h3 className="font-semibold text-slate-800 mb-3">How to get Firebase credentials</h3>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>Go to the Firebase Console (console.firebase.google.com)</li>
          <li>Select your project (or create a new one)</li>
          <li>Click the gear icon → Project settings</li>
          <li>Scroll down to "Your apps" section</li>
          <li>If no web app exists, click "Add app" and select Web</li>
          <li>Download or copy the config as a JSON file</li>
        </ol>

        <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-500 mb-2">Example JSON format:</p>
          <pre className="text-xs text-slate-600 overflow-x-auto">
            {`{
  "apiKey": "AIzaSy...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc123"
}`}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
