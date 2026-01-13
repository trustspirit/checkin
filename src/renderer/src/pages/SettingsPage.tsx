import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { reinitializeFirebase } from '../services/firebase'
import { changeLanguage, getCurrentLanguage } from '../i18n'

function SettingsPage(): React.ReactElement {
  const { t } = useTranslation()
  const [configPath, setConfigPath] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage())

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

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang)
    setCurrentLang(lang)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-3 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#050505] mb-2">{t('settings.title')}</h1>
        <p className="text-[#65676B]">{t('settings.databaseSettings')}</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-md border ${
            message.type === 'success'
              ? 'bg-[#EFFFF6] border-[#31A24C] text-[#31A24C]'
              : 'bg-[#FFEBEE] border-[#FA383E] text-[#FA383E]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Language Settings */}
      <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-[#050505] mb-4">{t('settings.language')}</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleLanguageChange('ko')}
            className={`px-4 py-2 rounded-md font-semibold transition-all ${
              currentLang === 'ko'
                ? 'bg-[#1877F2] text-white'
                : 'bg-[#E4E6EB] text-[#050505] hover:bg-[#D8DADF]'
            }`}
          >
            🇰🇷 {t('settings.korean')}
          </button>
          <button
            onClick={() => handleLanguageChange('en')}
            className={`px-4 py-2 rounded-md font-semibold transition-all ${
              currentLang === 'en'
                ? 'bg-[#1877F2] text-white'
                : 'bg-[#E4E6EB] text-[#050505] hover:bg-[#D8DADF]'
            }`}
          >
            🇺🇸 {t('settings.english')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#DADDE1] shadow-sm p-6">
        <h2 className="text-lg font-bold text-[#050505] mb-4">Firebase Configuration</h2>

        {isConfigured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-[#EFFFF6] border border-[#31A24C]/30 rounded-md">
              <div className="w-8 h-8 bg-[#31A24C] rounded-full flex items-center justify-center">
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
                <p className="font-semibold text-[#31A24C]">{t('settings.connected')}</p>
                <p className="text-sm text-[#31A24C]/80 truncate" title={configPath || ''}>
                  {configPath}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] shadow-sm transition-all"
              >
                {t('settings.importConfig')}
              </button>
              <button
                onClick={handleClearConfig}
                className="px-4 py-2 bg-[#E4E6EB] text-[#050505] rounded-md font-semibold hover:bg-[#D8DADF] transition-colors"
              >
                {t('settings.clearConfig')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-[#FFF8E1] border border-[#FFECB3] rounded-md">
              <div className="w-8 h-8 bg-[#FFC107] rounded-full flex items-center justify-center">
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
                <p className="font-semibold text-[#FFA000]">Not Configured</p>
                <p className="text-sm text-[#FFB300]">
                  Please import a Firebase configuration JSON file
                </p>
              </div>
            </div>

            <button
              onClick={handleImport}
              className="px-6 py-3 bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] shadow-sm transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {t('settings.importConfig')}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-lg p-6 border border-[#DADDE1] shadow-sm">
        <h3 className="font-bold text-[#050505] mb-3">How to get Firebase credentials</h3>
        <ol className="text-sm text-[#65676B] space-y-2 list-decimal list-inside">
          <li>Go to the Firebase Console (console.firebase.google.com)</li>
          <li>Select your project (or create a new one)</li>
          <li>Click the gear icon → Project settings</li>
          <li>Scroll down to "Your apps" section</li>
          <li>If no web app exists, click "Add app" and select Web</li>
          <li>Download or copy the config as a JSON file</li>
        </ol>

        <div className="mt-4 p-4 bg-[#F0F2F5] border border-[#DADDE1] rounded-md">
          <p className="text-xs font-semibold text-[#65676B] mb-2">Example JSON format:</p>
          <pre className="text-xs text-[#65676B] overflow-x-auto">
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
