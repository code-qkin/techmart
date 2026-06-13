import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Product, ProductVariant } from '../types'

export interface ReceiveLineItem {
  // product identity — will find-or-create
  productName: string
  productBrand: string
  productCategory: Product['category']
  // variant identity — optional, will find-or-create if any field is set
  storage?: string
  color?: string
  ram?: string
  condition?: 'New' | 'Open Box' | 'Pre-owned'
  // batch data
  quantity: number
  costPrice: number
  sellPrice?: number
  imeis?: string[]
  notes?: string
}

export interface ReceivePayload {
  supplier?: string
  receivedAt: string
  notes?: string
  receiveType: 'batch' | 'single'
  items: ReceiveLineItem[]
}

async function findOrCreateProduct(params: {
  name: string
  brand: string
  category: Product['category']
  supplier?: string
}): Promise<string> {
  const { data } = await supabase
    .from('products')
    .select('id')
    .ilike('name', params.name.trim())
    .ilike('brand', params.brand.trim())
    .maybeSingle()

  if (data) return (data as { id: string }).id

  const { data: created, error } = await supabase
    .from('products')
    .insert({
      id: crypto.randomUUID(),
      name: params.name.trim(),
      brand: params.brand.trim(),
      category: params.category,
      price: 0,
      stock: 0,
      low_stock_threshold: 3,
      emoji: '📦',
      supplier: params.supplier || null,
      variants: [],
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create product: ${error.message}`)
  return (created as { id: string }).id
}

async function findOrCreateVariant(params: {
  productId: string
  storage?: string
  color?: string
  ram?: string
  condition: 'New' | 'Open Box' | 'Pre-owned'
  costPrice?: number
  sellPrice?: number
}): Promise<string> {
  const { data: product, error } = await supabase
    .from('products')
    .select('variants')
    .eq('id', params.productId)
    .single()

  if (error) throw new Error(`Failed to fetch product variants: ${error.message}`)

  const variants = ((product as Record<string, unknown>).variants as ProductVariant[]) || []

  const existing = variants.find(v =>
    (v.storage || undefined) === (params.storage || undefined) &&
    (v.color || undefined) === (params.color || undefined) &&
    (v.ram || undefined) === (params.ram || undefined) &&
    v.condition === params.condition
  )

  if (existing) return existing.id

  const label = [params.storage, params.color, params.ram, params.condition]
    .filter(Boolean)
    .join(' · ')

  const newVariant: ProductVariant = {
    id: crypto.randomUUID(),
    storage: params.storage,
    color: params.color,
    ram: params.ram,
    condition: params.condition,
    label,
    stock: 0,
    price: params.sellPrice,
    costPrice: params.costPrice,
    units: [],
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ variants: [...variants, newVariant] })
    .eq('id', params.productId)

  if (updateError) throw new Error(`Failed to create variant: ${updateError.message}`)
  return newVariant.id
}

async function applyBatchToProduct(params: {
  productId: string
  variantId?: string
  quantity: number
  imeis: string[]
  supplier?: string
  sellPrice?: number
}) {
  if (params.variantId) {
    const { data: product } = await supabase
      .from('products')
      .select('variants')
      .eq('id', params.productId)
      .single()

    if (product?.variants) {
      const newUnits = params.imeis.filter(Boolean).map(imei => ({
        imei,
        supplier: params.supplier,
      }))
      const updated = ((product as Record<string, unknown>).variants as ProductVariant[]).map(v => {
        if (v.id !== params.variantId) return v
        const existingUnits = v.units || []
        return {
          ...v,
          stock: v.stock + params.quantity,
          price: params.sellPrice ?? v.price,
          units: [...existingUnits, ...newUnits],
        }
      })
      const totalStock = updated.reduce((sum, v) => sum + v.stock, 0)
      await supabase
        .from('products')
        .update({ variants: updated, stock: totalStock, stock_updated_at: new Date().toISOString() })
        .eq('id', params.productId)
    }
  } else {
    const { data: product } = await supabase
      .from('products')
      .select('stock, price')
      .eq('id', params.productId)
      .single()

    if (product) {
      const p = product as Record<string, unknown>
      await supabase
        .from('products')
        .update({
          stock: (p.stock as number) + params.quantity,
          price: params.sellPrice ?? (p.price as number),
          stock_updated_at: new Date().toISOString(),
        })
        .eq('id', params.productId)
    }
  }
}

export const useReceiving = () => {
  const queryClient = useQueryClient()

  const receiveMutation = useMutation({
    mutationFn: async (payload: ReceivePayload) => {
      const deliveryId = payload.receiveType === 'batch' ? crypto.randomUUID() : undefined
      const createdProducts: string[] = []

      for (const item of payload.items) {
        const hasVariant = !!(item.storage || item.color || item.ram || item.condition)

        const productId = await findOrCreateProduct({
          name: item.productName,
          brand: item.productBrand,
          category: item.productCategory,
          supplier: payload.supplier,
        })

        if (!createdProducts.includes(productId)) createdProducts.push(productId)

        let variantId: string | undefined
        if (hasVariant) {
          variantId = await findOrCreateVariant({
            productId,
            storage: item.storage,
            color: item.color,
            ram: item.ram,
            condition: item.condition || 'New',
            costPrice: item.costPrice,
            sellPrice: item.sellPrice,
          })
        }

        const imeis = (item.imeis || []).filter(Boolean)

        const { error } = await supabase.from('batches').insert({
          id: crypto.randomUUID(),
          product_id: productId,
          variant_id: variantId || null,
          supplier: payload.supplier || null,
          quantity_received: item.quantity,
          quantity_remaining: item.quantity,
          cost_price: item.costPrice,
          sell_price: item.sellPrice || null,
          received_at: new Date(payload.receivedAt).toISOString(),
          notes: item.notes || payload.notes || null,
          delivery_id: deliveryId || null,
          created_at: new Date().toISOString(),
        })
        if (error) throw new Error(`Failed to insert batch: ${error.message}`)

        await applyBatchToProduct({
          productId,
          variantId,
          quantity: item.quantity,
          imeis,
          supplier: payload.supplier,
          sellPrice: item.sellPrice,
        })
      }

      return { deliveryId, productCount: createdProducts.length, itemCount: payload.items.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  return {
    receive: receiveMutation.mutateAsync,
    isReceiving: receiveMutation.isPending,
  }
}
