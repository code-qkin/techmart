import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Order } from '../types'

const toOrder = (row: Record<string, unknown>): Order => ({
  id: row.id as string,
  staffId: row.staff_id as string,
  staffName: row.staff_name as string,
  customerName: row.customer_name as string,
  customerPhone: row.customer_phone as string,
  items: (row.items as Order['items']) || [],
  subtotal: row.subtotal as number,
  taxAmount: row.tax_amount as number,
  discountAmount: row.discount_amount as number,
  totalAmount: row.total_amount as number,
  paymentMethod: row.payment_method as Order['paymentMethod'],
  paymentStatus: row.payment_status as Order['paymentStatus'],
  transactionReference: row.transaction_reference as string | undefined,
  status: row.status as Order['status'],
  installment: row.installment as Order['installment'],
  notes: row.notes as string | undefined,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

export const useOrders = () => {
  const queryClient = useQueryClient()

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(toOrder)
    },
  })

  const addOrderMutation = useMutation({
    mutationFn: async (newOrder: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => {
      // Single atomic RPC: validates stock, inserts order, deducts stock — no race condition
      const { data, error } = await supabase.rpc('place_order', {
        order_data: {
          staffId: newOrder.staffId || null,
          staffName: newOrder.staffName,
          customerName: newOrder.customerName,
          customerPhone: newOrder.customerPhone,
          items: newOrder.items,
          subtotal: newOrder.subtotal,
          taxAmount: newOrder.taxAmount,
          discountAmount: newOrder.discountAmount,
          totalAmount: newOrder.totalAmount,
          paymentMethod: newOrder.paymentMethod,
          paymentStatus: newOrder.paymentStatus,
          transactionReference: newOrder.transactionReference || null,
          status: newOrder.status,
          installment: newOrder.installment || null,
          notes: newOrder.notes || null,
        },
      })
      if (error) throw error

      // Fetch the created order to return it
      const orderId = (data as { id: string }).id
      const { data: created, error: fetchError } = await supabase
        .from('orders').select('*').eq('id', orderId).single()
      if (fetchError) throw fetchError
      return toOrder(created)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })

  const returnOrderMutation = useMutation({
    mutationFn: async (order: Order) => {
      // Mark order as Returned and payment as Unpaid
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'Returned', payment_status: 'Unpaid', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .select()
        .single()
      if (error) throw error

      // Restore stock for every item in the order
      for (const item of order.items) {
        if (item.variantId) {
          const { data: product } = await supabase
            .from('products')
            .select('variants')
            .eq('id', item.productId)
            .single()

          if (product?.variants) {
            const updatedVariants = (product.variants as Record<string, unknown>[]).map((v) => {
              if (v.id !== item.variantId) return v
              // Restore the unit back to the units array on return
              if (item.imei && Array.isArray(v.units)) {
                const units = [...(v.units as Array<{ imei: string; supplier?: string }>), { imei: item.imei, supplier: item.supplier }]
                return { ...v, units, stock: units.length }
              }
              return { ...v, stock: (v.stock as number) + item.quantity }
            })
            await supabase.from('products').update({ variants: updatedVariants }).eq('id', item.productId)
          }
        } else {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.productId)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({ stock: product.stock + item.quantity })
              .eq('id', item.productId)
          }
        }
      }

      // Restore batch quantity on return
      for (const item of order.items) {
        if (item.batchId) {
          const { data: b } = await supabase.from('batches').select('quantity_remaining, quantity_received').eq('id', item.batchId).single()
          if (b) {
            const bd = b as Record<string, unknown>
            await supabase.from('batches')
              .update({ quantity_remaining: Math.min(bd.quantity_received as number, (bd.quantity_remaining as number) + item.quantity) })
              .eq('id', item.batchId)
          }
        }
      }

      return toOrder(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })

  const updateOrderMutation = useMutation({
    mutationFn: async (updatedOrder: Order) => {
      const { data, error } = await supabase
        .from('orders')
        .update({
          staff_id: updatedOrder.staffId || null,
          staff_name: updatedOrder.staffName,
          customer_name: updatedOrder.customerName,
          customer_phone: updatedOrder.customerPhone,
          items: updatedOrder.items,
          subtotal: updatedOrder.subtotal,
          tax_amount: updatedOrder.taxAmount,
          discount_amount: updatedOrder.discountAmount,
          total_amount: updatedOrder.totalAmount,
          payment_method: updatedOrder.paymentMethod,
          payment_status: updatedOrder.paymentStatus,
          transaction_reference: updatedOrder.transactionReference || null,
          status: updatedOrder.status,
          installment: updatedOrder.installment || null,
          notes: updatedOrder.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedOrder.id)
        .select()
        .single()
      if (error) throw error
      return toOrder(data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    addOrder: addOrderMutation.mutateAsync,
    updateOrder: updateOrderMutation.mutateAsync,
    returnOrder: returnOrderMutation.mutateAsync,
  }
}
