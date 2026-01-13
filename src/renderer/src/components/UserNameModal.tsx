import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface UserNameModalProps {
  onSubmit: (name: string) => void
}

function UserNameModal({ onSubmit }: UserNameModalProps): React.ReactElement {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit(name.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-[#050505] mb-2">{t('home.welcome')}</h2>
        <p className="text-[#65676B] mb-6">{t('home.welcomeDesc')}</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.enterUserName')}
            autoFocus
            className="w-full px-4 py-3 border border-[#DADDE1] rounded-lg text-lg outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent mb-4"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-3 bg-[#1877F2] text-white rounded-lg font-semibold text-lg hover:bg-[#166FE5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('home.continue')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UserNameModal
