import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  storeName: string
  address: string
  phone: string
  email: string
  setStoreInfo: (info: { storeName: string; address: string; phone: string; email: string }) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      storeName: 'TechMart Lagos',
      address: '15 Broad Street, Lagos Island, Lagos',
      phone: '+234 801 234 5678',
      email: 'info@techmart.ng',
      setStoreInfo: (info) => set(info),
    }),
    { name: 'techmart-settings' }
  )
)
