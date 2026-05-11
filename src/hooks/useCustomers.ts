import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types'

const toCustomer = (row: Record<string, unknown>): Customer => ({
  id: row.id as string,
  name: row.name as string,
  phone: row.phone as string,
  email: row.email as string | undefined,
  totalOrders: row.total_orders as number,
  totalSpent: row.total_spent as number,
  lastOrderDate: row.last_order_date as string | undefined,
  notes: row.notes as string | undefined,
  createdAt: row.created_at as string,
})

export const useCustomers = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(toCustomer)
    },
  })

  const addMutation = useMutation({
    mutationFn: async (newCustomer: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email || null,
          notes: newCustomer.notes || null,
        })
        .select()
        .single()
      if (error) throw error
      return toCustomer(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })

  const updateMutation = useMutation({
    mutationFn: async (updated: Customer) => {
      const { data, error } = await supabase
        .from('customers')
        .update({
          name: updated.name,
          phone: updated.phone,
          email: updated.email || null,
          total_orders: updated.totalOrders,
          total_spent: updated.totalSpent,
          last_order_date: updated.lastOrderDate || null,
          notes: updated.notes || null,
        })
        .eq('id', updated.id)
        .select()
        .single()
      if (error) throw error
      return toCustomer(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })

  return {
    customers: query.data || [],
    isLoading: query.isLoading,
    addCustomer: addMutation.mutateAsync,
    updateCustomer: updateMutation.mutateAsync,
  }
}
