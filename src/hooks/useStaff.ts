import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await supabase.functions.invoke('create-staff', {
        body: {
          email: staffData.email,
          password: staffData.password,
          fullName: staffData.fullName,
          role: staffData.role,
          phone: staffData.phone,
        },
      })

      if (res.error) throw new Error(res.error.message)
      const json = res.data as { error?: string }
      if (json?.error) throw new Error(json.error)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const res = await supabase.functions.invoke('delete-staff', { body: { staffId } })
      if (res.error) throw new Error(res.error.message)
      const json = res.data as { error?: string }
      if (json?.error) throw new Error(json.error)
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
