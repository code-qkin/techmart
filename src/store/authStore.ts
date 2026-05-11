import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface User {
  id: string
  name: string
  role: 'ceo' | 'admin' | 'secretary'
  email: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

const toUser = (authEmail: string, profile: { id: string; name: string; role: string }): User => ({
  id: profile.id,
  name: profile.name,
  role: profile.role as User['role'],
  email: authEmail,
})

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', session.user.id)
        .single()
      if (profile) {
        set({ user: toUser(session.user.email!, profile), isLoading: false })
        return
      }
    }
    set({ isLoading: false })
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', data.user.id)
      .single()

    if (!profile) return false
    set({ user: toUser(data.user.email!, profile) })
    return true
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
