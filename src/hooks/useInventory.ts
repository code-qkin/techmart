import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

const toProduct = (row: Record<string, unknown>): Product => ({
  id: row.id as string,
  name: row.name as string,
  category: row.category as Product['category'],
  brand: row.brand as string,
  price: row.price as number,
  costPrice: row.cost_price as number | undefined,
  stock: row.stock as number,
  lowStockThreshold: row.low_stock_threshold as number,
  description: row.description as string | undefined,
  emoji: (row.emoji as string) || '📦',
  variants: (row.variants as Product['variants']) || [],
  supplier: row.supplier as string | undefined,
  createdAt: row.created_at as string,
})

export const useInventory = () => {
  const queryClient = useQueryClient()

  const inventoryQuery = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data.map(toProduct)
    },
  })

  const updateStockMutation = useMutation({
    mutationFn: async ({ productId, newStock }: { productId: string; newStock: number }) => {
      const { data, error } = await supabase
        .from('products')
        .update({ stock: Math.max(0, newStock) })
        .eq('id', productId)
        .select()
        .single()
      if (error) throw error
      return toProduct(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return {
    inventory: inventoryQuery.data || [],
    isLoading: inventoryQuery.isLoading,
    updateStock: updateStockMutation.mutateAsync,
  }
}
