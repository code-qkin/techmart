import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  isDark: boolean
  toggle: () => void
}

const applyClass = (dark: boolean) => {
  document.documentElement.classList.toggle('dark', dark)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      toggle: () => {
        const next = !get().isDark
        applyClass(next)
        set({ isDark: next })
      },
    }),
    {
      name: 'techmart-theme',
      onRehydrateStorage: () => (state) => {
        applyClass(state?.isDark ?? false)
      },
    }
  )
)
