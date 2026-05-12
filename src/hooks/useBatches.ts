import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Batch } from '../types'

const toBatch = (row: Record<string, unknown>): Batch => ({
  id: row.id as string,
  productId: row.product_id as string,
  variantId: row.variant_id as string | undefined,
  supplier: row.supplier as string | undefined,
  quantityReceived: row.quantity_received as number,
  quantityRemaining: row.quantity_remaining as number,
  costPrice: row.cost_price as number,
  sellPrice: row.sell_price as number | undefined,
  receivedAt: row.received_at as string,
  notes: row.notes as string | undefined,
  createdAt: row.created_at as string,
})

export const useBatches = () => {
  const queryClient = useQueryClient()

  const batchesQuery = useQuery({
    queryKey: ['batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('received_at', { ascending: false })
      if (error) throw error
      return data.map(toBatch)
    },
  })

  const receiveMutation = useMutation({
    mutationFn: async (batch: {
      productId: string
      variantId?: string
      supplier?: string
      quantity: number
      costPrice: number
      sellPrice?: number
      notes?: string
      receivedAt: string
    }) => {
      const { error } = await supabase.from('batches').insert({
        product_id: batch.productId,
        variant_id: batch.variantId || null,
        supplier: batch.supplier || null,
        quantity_received: batch.quantity,
        quantity_remaining: batch.quantity,
        cost_price: batch.costPrice,
        sell_price: batch.sellPrice || null,
        received_at: batch.receivedAt,
        notes: batch.notes || null,
      })
      if (error) throw error

      // Update product stock
      if (batch.variantId) {
        const { data: product } = await supabase
          .from('products')
          .select('variants')
          .eq('id', batch.productId)
          .single()

        if (product?.variants) {
          const updated = (product.variants as Record<string, unknown>[]).map((v) =>
            v.id === batch.variantId ? { ...v, stock: (v.stock as number) + batch.quantity } : v
          )
          await supabase
            .from('products')
            .update({ variants: updated, stock_updated_at: new Date().toISOString() })
            .eq('id', batch.productId)
        }
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', batch.productId)
          .single()

        if (product) {
          await supabase
            .from('products')
            .update({ stock: (product as Record<string, unknown>).stock as number + batch.quantity, stock_updated_at: new Date().toISOString() })
            .eq('id', batch.productId)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const deductMutation = useMutation({
    mutationFn: async ({ batchId, qty }: { batchId: string; qty: number }) => {
      const { data } = await supabase
        .from('batches')
        .select('quantity_remaining')
        .eq('id', batchId)
        .single()
      if (data) {
        await supabase
          .from('batches')
          .update({ quantity_remaining: Math.max(0, (data as Record<string, unknown>).quantity_remaining as number - qty) })
          .eq('id', batchId)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  })

  const restoreMutation = useMutation({
    mutationFn: async ({ batchId, qty }: { batchId: string; qty: number }) => {
      const { data } = await supabase
        .from('batches')
        .select('quantity_remaining, quantity_received')
        .eq('id', batchId)
        .single()
      if (data) {
        const b = data as Record<string, unknown>
        await supabase
          .from('batches')
          .update({ quantity_remaining: Math.min(b.quantity_received as number, (b.quantity_remaining as number) + qty) })
          .eq('id', batchId)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  })

  return {
    batches: batchesQuery.data || [],
    isLoading: batchesQuery.isLoading,
    receiveBatch: receiveMutation.mutateAsync,
    deductBatch: deductMutation.mutateAsync,
    restoreBatch: restoreMutation.mutateAsync,
  }
}
