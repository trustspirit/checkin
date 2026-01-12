import { atom } from 'jotai'

const STORAGE_KEY = 'checkin_user_name'

const getStoredUserName = (): string | null => {
  return localStorage.getItem(STORAGE_KEY)
}

export const userNameAtom = atom<string | null>(getStoredUserName())

export const setUserNameAtom = atom(null, (_get, set, name: string) => {
  localStorage.setItem(STORAGE_KEY, name)
  set(userNameAtom, name)
})

export const clearUserNameAtom = atom(null, (_get, set) => {
  localStorage.removeItem(STORAGE_KEY)
  set(userNameAtom, null)
})
