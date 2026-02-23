import { atom } from 'jotai'
import type { User } from 'firebase/auth'

export const authUserAtom = atom<User | null>(null)
export const authLoadingAtom = atom<boolean>(true)
