import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Supplier } from '../types'

const toSupplier = (row: Record<string, unknown>): Supplier => ({
  name: row.name as string,
  location: row.location as string | undefined,
  phone: row.phone as string | undefined,
  email: row.email as string | undefined,
  contactPerson: row.contact_person as string | undefined,
  notes: row.notes as string | undefined,
})

export const useSuppliers = () => {
  const queryClient = useQueryClient()

  const suppliersQuery = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data.map(toSupplier)
    },
  })

  const addMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { error } = await supabase.from('suppliers').insert({
        name: supplier.name,
        location: supplier.location || null,
        phone: supplier.phone || null,
        email: supplier.email || null,
        contact_person: supplier.contactPerson || null,
        notes: supplier.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  })

  const updateMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { error } = await supabase
        .from('suppliers')
        .update({
          location: supplier.location || null,
          phone: supplier.phone || null,
          email: supplier.email || null,
          contact_person: supplier.contactPerson || null,
          notes: supplier.notes || null,
        })
        .eq('name', supplier.name)
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
    updateSupplier: updateMutation.mutateAsync,
    removeSupplier: removeMutation.mutateAsync,
  }
}
