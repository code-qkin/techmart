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
      units?: { imei: string; supplier?: string }[]
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
          const newUnits = (batch.units || []).filter(u => u.imei)
          const updated = (product.variants as Record<string, unknown>[]).map((v) => {
            if (v.id !== batch.variantId) return v
            const existingUnits = (v.units as Record<string, unknown>[] | undefined) || []
            return {
              ...v,
              stock: (v.stock as number) + batch.quantity,
              units: [...existingUnits, ...newUnits],
            }
          })
          const totalStock = updated.reduce((sum, v) => sum + (v.stock as number), 0)
          await supabase
            .from('products')
            .update({ variants: updated, stock: totalStock, stock_updated_at: new Date().toISOString() })
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

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      batch: Batch
      supplier?: string
      costPrice: number
      sellPrice?: number
      notes?: string
      receivedAt: string
      newQuantityReceived: number
    }) => {
      const { batch, newQuantityReceived } = payload
      const qtyDelta = newQuantityReceived - batch.quantityReceived
      const newRemaining = Math.max(0, batch.quantityRemaining + qtyDelta)

      const { error } = await supabase
        .from('batches')
        .update({
          supplier: payload.supplier || null,
          cost_price: payload.costPrice,
          sell_price: payload.sellPrice || null,
          notes: payload.notes || null,
          received_at: payload.receivedAt,
          quantity_received: newQuantityReceived,
          quantity_remaining: newRemaining,
        })
        .eq('id', batch.id)
      if (error) throw error

      // Adjust product stock if quantity changed
      if (qtyDelta !== 0) {
        if (batch.variantId) {
          const { data: product } = await supabase
            .from('products')
            .select('variants')
            .eq('id', batch.productId)
            .single()
          if (product?.variants) {
            const updated = (product.variants as Record<string, unknown>[]).map((v) =>
              v.id === batch.variantId
                ? { ...v, stock: Math.max(0, (v.stock as number) + qtyDelta) }
                : v
            )
            const totalStock = updated.reduce((sum, v) => sum + (v.stock as number), 0)
            await supabase
              .from('products')
              .update({ variants: updated, stock: totalStock })
              .eq('id', batch.productId)
          }
        } else {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', batch.productId)
            .single()
          if (product) {
            const cur = (product as Record<string, unknown>).stock as number
            await supabase
              .from('products')
              .update({ stock: Math.max(0, cur + qtyDelta) })
              .eq('id', batch.productId)
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (batch: Batch) => {
      const { error } = await supabase.from('batches').delete().eq('id', batch.id)
      if (error) throw error

      // Reverse the remaining stock that was still sitting in inventory
      if (batch.quantityRemaining > 0) {
        if (batch.variantId) {
          const { data: product } = await supabase
            .from('products')
            .select('variants')
            .eq('id', batch.productId)
            .single()
          if (product?.variants) {
            const updated = (product.variants as Record<string, unknown>[]).map((v) =>
              v.id === batch.variantId
                ? { ...v, stock: Math.max(0, (v.stock as number) - batch.quantityRemaining) }
                : v
            )
            const totalStock = updated.reduce((sum, v) => sum + (v.stock as number), 0)
            await supabase
              .from('products')
              .update({ variants: updated, stock: totalStock })
              .eq('id', batch.productId)
          }
        } else {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', batch.productId)
            .single()
          if (product) {
            const cur = (product as Record<string, unknown>).stock as number
            await supabase
              .from('products')
              .update({ stock: Math.max(0, cur - batch.quantityRemaining) })
              .eq('id', batch.productId)
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  return {
    batches: batchesQuery.data || [],
    isLoading: batchesQuery.isLoading,
    receiveBatch: receiveMutation.mutateAsync,
    deductBatch: deductMutation.mutateAsync,
    restoreBatch: restoreMutation.mutateAsync,
    updateBatch: updateMutation.mutateAsync,
    deleteBatch: deleteMutation.mutateAsync,
  }
}
