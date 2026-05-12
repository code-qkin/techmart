import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useSuppliers = () => {
  const queryClient = useQueryClient()

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('name')
        .order('name', { ascending: true })
      if (error) throw error
      return data.map((r) => r.name as string)
    },
  })

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('suppliers').insert({ name })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('name', name)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  })

  return {
    suppliers: suppliersQuery.data || [],
    isLoading: suppliersQuery.isLoading,
    addSupplier: addMutation.mutateAsync,
    removeSupplier: removeMutation.mutateAsync,
  }
}
