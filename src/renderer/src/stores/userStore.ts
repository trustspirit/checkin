import { atom } from 'jotai'
import type { AppUser } from '../services/firebase'

// Current active user - always starts as null (ask on every app start)
export const userNameAtom = atom<string | null>(null)

// List of all saved users from Firebase
export const savedUsersAtom = atom<AppUser[]>([])

// Loading state for users
export const usersLoadingAtom = atom<boolean>(true)

// Set current user (session only, not persisted)
export const setUserNameAtom = atom(null, (_get, set, name: string) => {
  set(userNameAtom, name)
})

// Clear current user (logout) - keeps saved users list
export const clearUserNameAtom = atom(null, (_get, set) => {
  set(userNameAtom, null)
})

// Update saved users list (called from Firebase subscription)
export const updateSavedUsersAtom = atom(null, (_get, set, users: AppUser[]) => {
  set(savedUsersAtom, users)
  set(usersLoadingAtom, false)
})
