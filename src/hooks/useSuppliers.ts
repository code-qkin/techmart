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
    mutationFn: async ({ oldName, supplier }: { oldName: string; supplier: Supplier }) => {
      const nameChanged = supplier.name.trim() !== oldName

      if (nameChanged) {
        // Insert the new name first (name is PK so we can't update it in-place)
        const { error: insertErr } = await supabase.from('suppliers').insert({
          name: supplier.name.trim(),
          location: supplier.location || null,
          phone: supplier.phone || null,
          email: supplier.email || null,
          contact_person: supplier.contactPerson || null,
          notes: supplier.notes || null,
        })
        if (insertErr) throw insertErr

        // Cascade: update batches that reference the old name
        await supabase.from('batches').update({ supplier: supplier.name.trim() }).eq('supplier', oldName)

        // Cascade: update products that reference the old name directly
        await supabase.from('products').update({ supplier: supplier.name.trim() }).eq('supplier', oldName)

        // Delete the old supplier row
        const { error: deleteErr } = await supabase.from('suppliers').delete().eq('name', oldName)
        if (deleteErr) throw deleteErr
      } else {
        // Name unchanged — simple update of other fields
        const { error } = await supabase
          .from('suppliers')
          .update({
            location: supplier.location || null,
            phone: supplier.phone || null,
            email: supplier.email || null,
            contact_person: supplier.contactPerson || null,
            notes: supplier.notes || null,
          })
          .eq('name', oldName)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const ensureMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      // upsert — does nothing if name already exists
      await supabase.from('suppliers').upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
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
    ensureSupplier: ensureMutation.mutateAsync,
    removeSupplier: removeMutation.mutateAsync,
  }
}
