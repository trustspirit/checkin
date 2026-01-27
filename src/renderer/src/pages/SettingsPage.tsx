import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue, useSetAtom } from 'jotai'
import { reinitializeFirebase, resetAllData } from '../services/firebase'
import { syncAtom } from '../stores/dataStore'
import { addToastAtom } from '../stores/toastStore'
import { userNameAtom, clearUserNameAtom } from '../stores/userStore'
import {
  eventPeriodStartAtom,
  eventPeriodEndAtom,
  setEventPeriodAtom,
  clearEventPeriodAtom
} from '../stores/scheduleStore'
import { changeLanguage, getCurrentLanguage } from '../i18n'
import { ConfirmDialog, SectionCard } from '../components/ui'

function SettingsPage(): React.ReactElement {
  const { t } = useTranslation()
  const sync = useSetAtom(syncAtom)
  const addToast = useSetAtom(addToastAtom)
  const currentUser = useAtomValue(userNameAtom)
  const clearUserName = useSetAtom(clearUserNameAtom)
  const eventPeriodStart = useAtomValue(eventPeriodStartAtom)
  const eventPeriodEnd = useAtomValue(eventPeriodEndAtom)
  const setEventPeriod = useSetAtom(setEventPeriodAtom)
  const clearEventPeriod = useSetAtom(clearEventPeriodAtom)
  const [configPath, setConfigPath] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage())
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Event period form state
  const [eventStartInput, setEventStartInput] = useState('')
  const [eventEndInput, setEventEndInput] = useState('')

  // Initialize event period inputs from stored values
  useEffect(() => {
    if (eventPeriodStart) {
      setEventStartInput(formatDateForInput(eventPeriodStart))
    }
    if (eventPeriodEnd) {
      setEventEndInput(formatDateForInput(eventPeriodEnd))
    }
  }, [eventPeriodStart, eventPeriodEnd])

  // Format date for input (use local date to avoid timezone issues)
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Parse date string to local date
  const parseDateFromInput = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const handleSaveEventPeriod = () => {
    if (!eventStartInput || !eventEndInput) {
      addToast({ type: 'error', message: t('settings.eventPeriodRequired') })
      return
    }

    const startDate = parseDateFromInput(eventStartInput)
    const endDate = parseDateFromInput(eventEndInput)

    if (startDate > endDate) {
      addToast({ type: 'error', message: t('settings.eventPeriodInvalid') })
      return
    }

    setEventPeriod({ startDate, endDate })
    addToast({ type: 'success', message: t('settings.eventPeriodSaved') })
  }

  const handleClearEventPeriod = () => {
    clearEventPeriod()
    setEventStartInput('')
    setEventEndInput('')
    addToast({ type: 'success', message: t('settings.eventPeriodCleared') })
  }

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
          text: t('settings.configSuccess')
        })
      } else {
        setMessage({
          type: 'error',
          text: result.error || t('settings.configFailed')
        })
      }
    } catch {
      setMessage({ type: 'error', text: t('settings.configFailed') })
    }
  }

  const handleClearConfig = async () => {
    try {
      await window.electronAPI.clearConfig()
      setConfigPath(null)
      setIsConfigured(false)
      setMessage({
        type: 'success',
        text: t('settings.configCleared')
      })
    } catch {
      setMessage({ type: 'error', text: t('settings.clearConfigFailed') })
    }
  }

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang)
    setCurrentLang(lang)
  }

  const handleResetData = async () => {
    setIsResetting(true)
    try {
      const result = await resetAllData()
      if (result.success) {
        await sync()
        addToast({
          type: 'success',
          message: `${t('settings.resetDataSuccess')} (${t('settings.deleted')}: ${result.participantsDeleted} ${t('nav.participants')}, ${result.groupsDeleted} ${t('nav.groups')}, ${result.roomsDeleted} ${t('nav.rooms')})`
        })
        setShowResetDialog(false)
      } else {
        addToast({ type: 'error', message: result.error || t('settings.resetDataFailed') })
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : t('settings.resetDataFailed')
      })
    } finally {
      setIsResetting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="w-8 h-8 border-3 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#050505] mb-2">{t('settings.title')}</h1>
        <p className="text-[#65676B]">{t('settings.databaseSettings')}</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md border ${
            message.type === 'success'
              ? 'bg-[#EFFFF6] border-[#31A24C] text-[#31A24C]'
              : 'bg-[#FFEBEE] border-[#FA383E] text-[#FA383E]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current User */}
      <SectionCard title={t('settings.currentUser')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1877F2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
              {currentUser?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="font-medium text-[#050505]">{currentUser}</span>
          </div>
          <button
            onClick={() => clearUserName()}
            className="px-4 py-2 bg-[#E4E6EB] text-[#050505] hover:bg-[#D8DADF] rounded-md font-semibold transition-colors"
          >
            {t('settings.switchUser')}
          </button>
        </div>
      </SectionCard>

      {/* Language Settings */}
      <SectionCard title={t('settings.language')}>
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
      </SectionCard>

      {/* Event Period Settings */}
      <SectionCard title={t('settings.eventPeriod')} description={t('settings.eventPeriodDesc')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#65676B] mb-1">
                {t('settings.eventStartDate')}
              </label>
              <input
                type="date"
                value={eventStartInput}
                onChange={(e) => setEventStartInput(e.target.value)}
                className="w-full px-3 py-2 border border-[#DADDE1] rounded-lg text-sm focus:outline-none focus:border-[#1877F2]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#65676B] mb-1">
                {t('settings.eventEndDate')}
              </label>
              <input
                type="date"
                value={eventEndInput}
                onChange={(e) => setEventEndInput(e.target.value)}
                className="w-full px-3 py-2 border border-[#DADDE1] rounded-lg text-sm focus:outline-none focus:border-[#1877F2]"
              />
            </div>
          </div>

          {eventPeriodStart && eventPeriodEnd && (
            <div className="p-3 bg-[#E7F3FF] border border-[#1877F2]/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-[#1877F2]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>
                  {t('settings.currentEventPeriod')}:{' '}
                  <strong>
                    {eventPeriodStart.toLocaleDateString()} - {eventPeriodEnd.toLocaleDateString()}
                  </strong>
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveEventPeriod}
              className="px-4 py-2 bg-[#1877F2] text-white rounded-md font-semibold hover:bg-[#166FE5] transition-colors"
            >
              {t('common.save')}
            </button>
            {eventPeriodStart && eventPeriodEnd && (
              <button
                onClick={handleClearEventPeriod}
                className="px-4 py-2 bg-[#E4E6EB] text-[#050505] rounded-md font-semibold hover:bg-[#D8DADF] transition-colors"
              >
                {t('common.clear')}
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Firebase Configuration */}
      <SectionCard title={t('settings.firebaseConfig')}>
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
                <p className="font-semibold text-[#FFA000]">{t('settings.disconnected')}</p>
                <p className="text-sm text-[#FFB300]">{t('settings.pleaseImportConfig')}</p>
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
      </SectionCard>

      {/* Data Management */}
      {isConfigured && (
        <SectionCard
          title={t('settings.dataManagement')}
          description={t('settings.resetDataDesc')}
          variant="danger"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FA383E]/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[#FA383E]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[#050505]">{t('settings.resetData')}</p>
                <p className="text-sm text-[#65676B]">{t('settings.resetDataWarning')}</p>
              </div>
            </div>
            <button
              onClick={() => setShowResetDialog(true)}
              className="px-4 py-2 bg-[#FA383E] text-white rounded-md font-semibold hover:bg-[#E53935] transition-colors"
            >
              {t('settings.resetData')}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Firebase Setup Help */}
      <SectionCard title={t('settings.howToGetCredentials')}>
        <ol className="text-sm text-[#65676B] space-y-2 list-decimal list-inside">
          <li>{t('settings.step1')}</li>
          <li>{t('settings.step2')}</li>
          <li>{t('settings.step3')}</li>
          <li>{t('settings.step4')}</li>
          <li>{t('settings.step5')}</li>
          <li>{t('settings.step6')}</li>
        </ol>

        <div className="mt-4 p-4 bg-[#F0F2F5] border border-[#DADDE1] rounded-md">
          <p className="text-xs font-semibold text-[#65676B] mb-2">
            {t('settings.exampleJsonFormat')}
          </p>
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
      </SectionCard>

      {/* Reset Data Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetData}
        title={t('settings.resetDataConfirmTitle')}
        description={`${t('settings.resetDataConfirmDesc')}\n\n• ${t('settings.resetDataConfirmItem1')}\n• ${t('settings.resetDataConfirmItem2')}\n• ${t('settings.resetDataConfirmItem3')}\n\n${t('settings.resetDataConfirmWarning')}`}
        confirmText={isResetting ? t('settings.resetting') : t('settings.resetData')}
        variant="danger"
        confirmationPhrase="DELETE"
        isLoading={isResetting}
      />
    </div>
  )
}

export default SettingsPage
