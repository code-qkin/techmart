import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Expense } from '../types'

const toExpense = (row: Record<string, unknown>): Expense => ({
  id: row.id as string,
  category: row.category as Expense['category'],
  description: row.description as string,
  amount: row.amount as number,
  date: row.date as string,
  recordedBy: row.recorded_by as string,
  createdAt: row.created_at as string,
})

export const useExpenses = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(toExpense)
    },
  })

  const addMutation = useMutation({
    mutationFn: async (newExpense: Omit<Expense, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          category: newExpense.category,
          description: newExpense.description,
          amount: newExpense.amount,
          date: newExpense.date,
          recorded_by: newExpense.recordedBy,
        })
        .select()
        .single()
      if (error) throw error
      return toExpense(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })

  return {
    expenses: query.data || [],
    isLoading: query.isLoading,
    addExpense: addMutation.mutateAsync,
    deleteExpense: deleteMutation.mutateAsync,
  }
}
