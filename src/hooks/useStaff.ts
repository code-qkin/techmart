import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, adminSupabase } from '../lib/supabase'
import type { StaffMember } from '../types'

const toStaff = (row: Record<string, unknown>): StaffMember => ({
  id: row.id as string,
  fullName: row.name as string,
  role: row.role as StaffMember['role'],
  email: (row.email as string) || '',
  phone: (row.phone as string) || '',
  joinedDate: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
    .format(new Date(row.created_at as string)),
  isActive: row.is_active as boolean,
})

interface NewStaffData {
  fullName: string
  email: string
  phone: string
  role: StaffMember['role']
  password: string
}

export const useStaff = () => {
  const queryClient = useQueryClient()

  const staffQuery = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data.map(toStaff)
    },
  })

  const addStaffMutation = useMutation({
    mutationFn: async (staffData: NewStaffData) => {
      if (!adminSupabase) {
        throw new Error('Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env.local to enable staff creation')
      }

      // Create the auth account using the admin API — no rate limits,
      // no email confirmation required, current session is untouched.
      const { data, error: createError } = await adminSupabase.auth.admin.createUser({
        email: staffData.email,
        password: staffData.password,
        email_confirm: true,
      })
      if (createError) throw createError
      if (!data.user) throw new Error('Failed to create staff account')

      // The DB trigger inserts a default profile row; update it with real data.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: staffData.fullName,
          role: staffData.role,
          phone: staffData.phone,
          is_active: true,
        })
        .eq('id', data.user.id)
      if (profileError) throw profileError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      if (!adminSupabase) {
        throw new Error('Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env.local to enable staff deletion')
      }
      // Delete from auth — the FK cascade removes the profiles row automatically
      const { error } = await adminSupabase.auth.admin.deleteUser(staffId)
      if (error) throw error
      // Explicit profile delete as a safety net in case cascade isn't configured
      await supabase.from('profiles').delete().eq('id', staffId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const current = staffQuery.data?.find((s) => s.id === staffId)
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: !current?.isActive })
        .eq('id', staffId)
        .select()
        .single()
      if (error) throw error
      return toStaff(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  const updateStaffMutation = useMutation({
    mutationFn: async (member: StaffMember) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ name: member.fullName, phone: member.phone, role: member.role })
        .eq('id', member.id)
        .select()
        .single()
      if (error) throw error
      return toStaff(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  return {
    staff: staffQuery.data || [],
    isLoading: staffQuery.isLoading,
    addStaff: addStaffMutation.mutateAsync,
    deleteStaff: deleteStaffMutation.mutateAsync,
    toggleStatus: toggleStatusMutation.mutateAsync,
    updateStaff: updateStaffMutation.mutateAsync,
  }
}
