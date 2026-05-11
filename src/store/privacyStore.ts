import { create } from 'zustand'

interface PrivacyState {
  isHidden: boolean
  toggle: () => void
}

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  isHidden: false,
  toggle: () => set({ isHidden: !get().isHidden }),
}))

export const maskAmount = (value: string, isHidden: boolean) =>
  isHidden ? '₦ ••••••' : value
