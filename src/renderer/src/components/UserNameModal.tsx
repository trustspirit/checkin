import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue, useSetAtom } from 'jotai'
import { savedUsersAtom, usersLoadingAtom, updateSavedUsersAtom } from '../stores/userStore'
import { saveUser, removeUser, subscribeToUsers, isFirebaseConfigured } from '../services/firebase'

interface UserNameModalProps {
  onSubmit: (name: string) => void
}

function UserNameModal({ onSubmit }: UserNameModalProps): React.ReactElement {
  const { t } = useTranslation()
  const savedUsers = useAtomValue(savedUsersAtom)
  const isLoading = useAtomValue(usersLoadingAtom)
  const updateSavedUsers = useSetAtom(updateSavedUsersAtom)
  const [name, setName] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Subscribe to users from Firebase
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      updateSavedUsers([])
      return
    }

    const unsubscribe = subscribeToUsers((users) => {
      updateSavedUsers(users)
    })

    return () => unsubscribe()
  }, [updateSavedUsers])

  // Show add new form if no saved users
  useEffect(() => {
    if (!isLoading && savedUsers.length === 0) {
      setIsAddingNew(true)
    }
  }, [isLoading, savedUsers.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    try {
      if (isFirebaseConfigured()) {
        await saveUser(name.trim())
      }
      onSubmit(name.trim())
    } catch (error) {
      console.error('Error saving user:', error)
      // Still allow login even if save fails
      onSubmit(name.trim())
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectUser = async (selectedUser: { id: string; name: string }) => {
    setIsSaving(true)
    try {
      if (isFirebaseConfigured()) {
        // Update lastUsedAt
        await saveUser(selectedUser.name)
      }
      onSubmit(selectedUser.name)
    } catch (error) {
      console.error('Error updating user:', error)
      onSubmit(selectedUser.name)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveUser = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation()
    try {
      if (isFirebaseConfigured()) {
        await removeUser(userId)
      }
    } catch (error) {
      console.error('Error removing user:', error)
    }
  }

  if (isLoading && isFirebaseConfigured()) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-3 border-[#DADDE1] border-t-[#1877F2] rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-[#050505] mb-2">{t('home.welcome')}</h2>
        <p className="text-[#65676B] mb-6">{t('home.welcomeDesc')}</p>

        {/* Saved Users List */}
        {savedUsers.length > 0 && !isAddingNew && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#65676B] mb-2 uppercase tracking-wide">
              {t('user.selectUser')}
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {savedUsers.map((savedUser) => (
                <button
                  key={savedUser.id}
                  onClick={() => handleSelectUser(savedUser)}
                  disabled={isSaving}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#F0F2F5] hover:bg-[#E4E6EB] rounded-md transition-colors group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#1877F2] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                      {savedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm text-[#050505]">{savedUser.name}</span>
                  </div>
                  <button
                    onClick={(e) => handleRemoveUser(e, savedUser.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#DADDE1] rounded-full transition-all"
                    title={t('user.removeUser')}
                  >
                    <svg
                      className="w-4 h-4 text-[#65676B]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-[#DADDE1]">
              <button
                onClick={() => setIsAddingNew(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-[#DADDE1] hover:border-[#1877F2] hover:bg-[#F0F8FF] rounded-md transition-colors text-[#65676B] hover:text-[#1877F2] text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="font-medium">{t('user.addNewUser')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Add New User Form */}
        {(isAddingNew || savedUsers.length === 0) && (
          <form onSubmit={handleSubmit}>
            {savedUsers.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-[#65676B]">
                  {t('user.enterNewName')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-sm text-[#1877F2] hover:underline font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.enterUserName')}
              autoFocus
              disabled={isSaving}
              className="w-full px-4 py-3 border border-[#DADDE1] rounded-lg text-lg outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent mb-4 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="w-full py-3 bg-[#1877F2] text-white rounded-lg font-semibold text-lg hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
              {t('home.continue')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default UserNameModal
