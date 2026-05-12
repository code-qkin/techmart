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
  stockUpdatedAt: row.stock_updated_at as string | undefined,
})

export const useProducts = () => {
  const queryClient = useQueryClient()

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(toProduct)
    },
  })

  const addProductMutation = useMutation({
    mutationFn: async (newProduct: Omit<Product, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: newProduct.name,
          category: newProduct.category,
          brand: newProduct.brand,
          price: newProduct.price,
          cost_price: newProduct.costPrice ?? null,
          stock: newProduct.stock,
          low_stock_threshold: newProduct.lowStockThreshold,
          description: newProduct.description,
          emoji: newProduct.emoji,
          variants: newProduct.variants || [],
          supplier: newProduct.supplier,
        })
        .select()
        .single()
      if (error) throw error
      return toProduct(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: async (updatedProduct: Product) => {
      const { data, error } = await supabase
        .from('products')
        .update({
          name: updatedProduct.name,
          category: updatedProduct.category,
          brand: updatedProduct.brand,
          price: updatedProduct.price,
          cost_price: updatedProduct.costPrice ?? null,
          stock: updatedProduct.stock,
          low_stock_threshold: updatedProduct.lowStockThreshold,
          description: updatedProduct.description,
          emoji: updatedProduct.emoji,
          variants: updatedProduct.variants || [],
          supplier: updatedProduct.supplier,
          stock_updated_at: new Date().toISOString(),
        })
        .eq('id', updatedProduct.id)
        .select()
        .single()
      if (error) throw error
      return toProduct(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    addProduct: addProductMutation.mutateAsync,
    updateProduct: updateProductMutation.mutateAsync,
    deleteProduct: deleteProductMutation.mutateAsync,
  }
}
