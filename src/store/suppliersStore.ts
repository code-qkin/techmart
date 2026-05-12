import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SuppliersState {
  suppliers: string[]
  addSupplier: (name: string) => void
  removeSupplier: (name: string) => void
}

export const useSuppliersStore = create<SuppliersState>()(
  persist(
    (set) => ({
      suppliers: ['Apple Official', 'Samsung Official', 'Slot Nigeria', 'Pointek', 'Jumia', 'Konga', 'Local Dealer'],
      addSupplier: (name) => set((s) => ({ suppliers: [...s.suppliers, name.trim()] })),
      removeSupplier: (name) => set((s) => ({ suppliers: s.suppliers.filter((x) => x !== name) })),
    }),
    { name: 'techmart-suppliers' }
  )
)
