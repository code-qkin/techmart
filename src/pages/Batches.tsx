import React, { useState, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/shared/PageHeader'
import { ExcelImport } from '../components/ExcelImport'
import { useBatches } from '../hooks/useBatches'
import { useProducts } from '../hooks/useProducts'
import { useSuppliers } from '../hooks/useSuppliers'
import { formatNaira } from '../lib/utils'
import { Search, Archive, X, Pencil, Trash2, Plus, Package, ChevronDown, ChevronRight, Truck, FileSpreadsheet, Download } from 'lucide-react'
import { getProductIcon } from '../lib/productIcon'
import { downloadImportTemplate } from '../lib/importTemplate'
import { cn } from '../lib/utils'
import type { Batch, Product } from '../types'
import { toast } from 'sonner'

export const Batches: React.FC = () => {
  const location = useLocation()
  const navState = location.state as { productId?: string; variantId?: string } | null
  const { batches, isLoading, receiveBatch, updateBatch, deleteBatch } = useBatches()
  const { products } = useProducts()
  const { suppliers } = useSuppliers()
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'depleted'>('all')
  const [pinnedProductId, setPinnedProductId] = useState<string | undefined>(navState?.productId)
  const [pinnedVariantId, setPinnedVariantId] = useState<string | undefined>(navState?.variantId)
  const [expandedDeliveries, setExpandedDeliveries] = useState<Set<string>>(new Set())

  // Edit modal state
  interface EditLine {
    batchId: string
    productId: string
    variantId?: string
    label: string
    quantity: string
    costPrice: string
    sellPrice: string
    originalQtyReceived: number
    originalQtyRemaining: number
    isNew?: boolean
  }

  const [editingDelivery, setEditingDelivery] = useState<{ key: string; batches: Batch[] } | null>(null)
  const [editDeliverySupplier, setEditDeliverySupplier] = useState('')
  const [editDeliveryDate, setEditDeliveryDate] = useState('')
  const [editDeliveryNotes, setEditDeliveryNotes] = useState('')
  const [editDeliveryLines, setEditDeliveryLines] = useState<EditLine[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Single-batch edit state
  const [editingSingle, setEditingSingle] = useState<Batch | null>(null)
  const [singleQty, setSingleQty] = useState('')
  const [singleCostPrice, setSingleCostPrice] = useState('')
  const [singleSellPrice, setSingleSellPrice] = useState('')
  const [singleSupplier, setSingleSupplier] = useState('')
  const [singleDate, setSingleDate] = useState('')
  const [singleNotes, setSingleNotes] = useState('')

  // Delete confirm state
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Delete whole delivery state
  const [deletingDelivery, setDeletingDelivery] = useState<{ key: string; batches: Batch[] } | null>(null)
  const [isDeletingDelivery, setIsDeletingDelivery] = useState(false)

  // Multi-product batch receive state
  interface VariantLine { variantId: string; label: string; quantity: string; costPrice: string; sellPrice: string }
  interface LineItem { key: number; productId: string; quantity: string; costPrice: string; sellPrice: string; variantLines: VariantLine[] }

  const makeVariantLines = (p: Product): VariantLine[] =>
    (p.variants || []).map(v => ({
      variantId: v.id,
      label: v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' · '),
      quantity: '',
      costPrice: v.costPrice ? String(v.costPrice) : (p.costPrice ? String(p.costPrice) : ''),
      sellPrice: v.price ? String(v.price) : (p.price ? String(p.price) : ''),
    }))

  const blankLine = (key: number): LineItem => ({ key, productId: '', quantity: '1', costPrice: '', sellPrice: '', variantLines: [] })

  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isMultiOpen, setIsMultiOpen] = useState(false)
  const [multiSupplier, setMultiSupplier] = useState('')
  const [multiDate, setMultiDate] = useState(new Date().toISOString().split('T')[0])
  const [multiNotes, setMultiNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [lineCounter, setLineCounter] = useState(0)
  const [isSubmittingMulti, setIsSubmittingMulti] = useState(false)

  const openMultiModal = () => {
    setMultiSupplier('')
    setMultiDate(new Date().toISOString().split('T')[0])
    setMultiNotes('')
    setLineItems([blankLine(0)])
    setLineCounter(1)
    setIsMultiOpen(true)
  }

  const addLine = () => {
    setLineItems(prev => [...prev, blankLine(lineCounter)])
    setLineCounter(c => c + 1)
  }

  const removeLine = (key: number) => setLineItems(prev => prev.filter(l => l.key !== key))

  const selectProduct = useCallback((key: number, productId: string, allProducts: Product[]) => {
    const p = allProducts.find(x => x.id === productId)
    setLineItems(prev => prev.map(l => {
      if (l.key !== key) return l
      if (!p) return { ...l, productId: '', variantLines: [], costPrice: '', sellPrice: '' }
      if ((p.variants?.length || 0) > 0) {
        return { ...l, productId, variantLines: makeVariantLines(p), quantity: '', costPrice: '', sellPrice: '' }
      }
      return { ...l, productId, variantLines: [], costPrice: p.costPrice ? String(p.costPrice) : '', sellPrice: p.price ? String(p.price) : '' }
    }))
  }, [])

  const updateLineField = useCallback((key: number, field: 'quantity' | 'costPrice' | 'sellPrice', value: string) => {
    setLineItems(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }, [])

  const updateVariantLine = useCallback((key: number, variantId: string, field: 'quantity' | 'costPrice' | 'sellPrice', value: string) => {
    setLineItems(prev => prev.map(l => {
      if (l.key !== key) return l
      return { ...l, variantLines: l.variantLines.map(vl => vl.variantId === variantId ? { ...vl, [field]: value } : vl) }
    }))
  }, [])

  const itemCount = useMemo(() => lineItems.reduce((sum, l) => {
    if (l.variantLines.length > 0) return sum + l.variantLines.filter(vl => Number(vl.quantity) > 0).length
    return sum + (l.productId && Number(l.quantity) > 0 ? 1 : 0)
  }, 0), [lineItems])

  const totalUnitsToReceive = useMemo(() => lineItems.reduce((sum, l) => {
    if (l.variantLines.length > 0) return sum + l.variantLines.reduce((s, vl) => s + (Number(vl.quantity) || 0), 0)
    return sum + (Number(l.quantity) || 0)
  }, 0), [lineItems])

  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (itemCount === 0) return
    setIsSubmittingMulti(true)
    // All items in this submission share one delivery ID
    const deliveryId = crypto.randomUUID()
    try {
      for (const line of lineItems) {
        if (line.variantLines.length > 0) {
          for (const vl of line.variantLines.filter(vl => Number(vl.quantity) > 0)) {
            await receiveBatch({
              productId: line.productId,
              variantId: vl.variantId,
              supplier: multiSupplier || undefined,
              quantity: Number(vl.quantity),
              costPrice: Number(vl.costPrice) || 0,
              sellPrice: Number(vl.sellPrice) || undefined,
              notes: multiNotes || undefined,
              receivedAt: new Date(multiDate).toISOString(),
              deliveryId,
            })
          }
        } else if (line.productId && Number(line.quantity) > 0) {
          await receiveBatch({
            productId: line.productId,
            supplier: multiSupplier || undefined,
            quantity: Number(line.quantity),
            costPrice: Number(line.costPrice) || 0,
            sellPrice: Number(line.sellPrice) || undefined,
            notes: multiNotes || undefined,
            receivedAt: new Date(multiDate).toISOString(),
            deliveryId,
          })
        }
      }
      toast.success(`Delivery received — ${itemCount} item${itemCount !== 1 ? 's' : ''}, ${totalUnitsToReceive} units`)
      setIsMultiOpen(false)
    } catch {
      toast.error('Failed to receive batch')
    } finally {
      setIsSubmittingMulti(false)
    }
  }

  const openDeliveryEdit = (key: string, groupBatches: Batch[]) => {
    const first = groupBatches[0]
    const lines: EditLine[] = groupBatches.map(b => {
      const prod = products.find(p => p.id === b.productId)
      const variant = prod?.variants?.find(v => v.id === b.variantId)
      const variantLabel = variant
        ? (variant.label || [variant.color, variant.storage, variant.ram, variant.condition].filter(Boolean).join(' · '))
        : undefined
      return {
        batchId: b.id,
        productId: b.productId,
        variantId: b.variantId,
        label: variantLabel || (prod?.name || b.productId),
        quantity: String(b.quantityReceived),
        costPrice: String(b.costPrice),
        sellPrice: b.sellPrice ? String(b.sellPrice) : '',
        originalQtyReceived: b.quantityReceived,
        originalQtyRemaining: b.quantityRemaining,
      }
    })
    // Append any variants added to the product after this delivery was created
    const coveredVariantIds = new Set(lines.map(l => l.variantId).filter(Boolean))
    const productIdsInDelivery = [...new Set(lines.map(l => l.productId))]
    for (const productId of productIdsInDelivery) {
      const prod = products.find(p => p.id === productId)
      if (!prod?.variants?.length) continue
      for (const v of prod.variants) {
        if (!coveredVariantIds.has(v.id)) {
          lines.push({
            batchId: `new-${v.id}`,
            productId,
            variantId: v.id,
            label: v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' · '),
            quantity: '',
            costPrice: v.costPrice ? String(v.costPrice) : (prod.costPrice ? String(prod.costPrice) : ''),
            sellPrice: v.price ? String(v.price) : (prod.price ? String(prod.price) : ''),
            originalQtyReceived: 0,
            originalQtyRemaining: 0,
            isNew: true,
          })
        }
      }
    }

    setEditDeliveryLines(lines)
    setEditDeliverySupplier(first.supplier || '')
    setEditDeliveryDate(new Date(first.receivedAt).toISOString().split('T')[0])
    setEditDeliveryNotes(first.notes || '')
    setEditingDelivery({ key, batches: groupBatches })
  }

  const updateEditLine = (batchId: string, field: 'quantity' | 'costPrice' | 'sellPrice', value: string) => {
    setEditDeliveryLines(prev => prev.map(l => l.batchId === batchId ? { ...l, [field]: value } : l))
  }

  const bulkUpdateEditLines = (batchIds: string[], field: 'costPrice' | 'sellPrice', value: string) => {
    setEditDeliveryLines(prev => prev.map(l => batchIds.includes(l.batchId) ? { ...l, [field]: value } : l))
  }

  const handleSaveDeliveryEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDelivery) return
    setIsSaving(true)
    try {
      for (const line of editDeliveryLines) {
        if (line.isNew) {
          if (Number(line.quantity) > 0) {
            await receiveBatch({
              productId: line.productId,
              variantId: line.variantId,
              supplier: editDeliverySupplier || undefined,
              quantity: Number(line.quantity),
              costPrice: Number(line.costPrice) || 0,
              sellPrice: Number(line.sellPrice) || undefined,
              notes: editDeliveryNotes || undefined,
              receivedAt: new Date(editDeliveryDate).toISOString(),
              deliveryId: editingDelivery.batches[0].deliveryId ?? editingDelivery.key,
            })
          }
        } else {
          const batch = editingDelivery.batches.find(b => b.id === line.batchId)
          if (!batch) continue
          await updateBatch({
            batch,
            supplier: editDeliverySupplier || undefined,
            costPrice: Number(line.costPrice) || 0,
            sellPrice: Number(line.sellPrice) || undefined,
            notes: editDeliveryNotes || undefined,
            receivedAt: new Date(editDeliveryDate).toISOString(),
            newQuantityReceived: Number(line.quantity),
          })
        }
      }
      toast.success('Delivery updated')
      setEditingDelivery(null)
    } catch {
      toast.error('Failed to update delivery')
    } finally {
      setIsSaving(false)
    }
  }

  const openSingleEdit = (b: Batch) => {
    setEditingSingle(b)
    setSingleQty(String(b.quantityReceived))
    setSingleCostPrice(String(b.costPrice))
    setSingleSellPrice(b.sellPrice ? String(b.sellPrice) : '')
    setSingleSupplier(b.supplier || '')
    setSingleDate(new Date(b.receivedAt).toISOString().split('T')[0])
    setSingleNotes(b.notes || '')
  }

  const handleSaveSingleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSingle) return
    setIsSaving(true)
    try {
      await updateBatch({
        batch: editingSingle,
        supplier: singleSupplier || undefined,
        costPrice: Number(singleCostPrice) || 0,
        sellPrice: Number(singleSellPrice) || undefined,
        notes: singleNotes || undefined,
        receivedAt: new Date(singleDate).toISOString(),
        newQuantityReceived: Number(singleQty),
      })
      toast.success('Batch updated')
      setEditingSingle(null)
    } catch {
      toast.error('Failed to update batch')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingBatch) return
    setIsDeleting(true)
    try {
      await deleteBatch(deletingBatch)
      toast.success('Batch deleted and stock reversed')
      setDeletingBatch(null)
    } catch {
      toast.error('Failed to delete batch')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDeleteDelivery = async () => {
    if (!deletingDelivery) return
    setIsDeletingDelivery(true)
    try {
      for (const b of deletingDelivery.batches) {
        await deleteBatch(b)
      }
      toast.success(`Delivery deleted — ${deletingDelivery.batches.length} batch${deletingDelivery.batches.length !== 1 ? 'es' : ''} removed`)
      setDeletingDelivery(null)
      setExpandedDeliveries(prev => { const n = new Set(prev); n.delete(deletingDelivery.key); return n })
    } catch {
      toast.error('Failed to delete delivery')
    } finally {
      setIsDeletingDelivery(false)
    }
  }

  const getProductName = (productId: string, variantId?: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return productId
    if (!variantId) return product.name
    const variant = product.variants?.find(v => v.id === variantId)
    if (!variant) return product.name
    const variantLabel = variant.label || [variant.color, variant.storage, variant.ram, variant.condition].filter(Boolean).join(' • ')
    return `${product.name} — ${variantLabel}`
  }


  const supplierOptions = useMemo(() => {
    const all = batches.map(b => b.supplier).filter(Boolean) as string[]
    return ['All', ...Array.from(new Set(all))]
  }, [batches])

  const pinnedProductName = pinnedProductId ? getProductName(pinnedProductId, pinnedVariantId) : null

  const filtered = useMemo(() => {
    return batches.filter(b => {
      if (pinnedProductId && b.productId !== pinnedProductId) return false
      if (pinnedVariantId && b.variantId !== pinnedVariantId) return false
      if (supplierFilter !== 'All' && b.supplier !== supplierFilter) return false
      if (statusFilter === 'active' && b.quantityRemaining === 0) return false
      if (statusFilter === 'depleted' && b.quantityRemaining > 0) return false
      if (search) {
        const name = getProductName(b.productId, b.variantId).toLowerCase()
        const supplier = (b.supplier || '').toLowerCase()
        const notes = (b.notes || '').toLowerCase()
        if (!name.includes(search.toLowerCase()) && !supplier.includes(search.toLowerCase()) && !notes.includes(search.toLowerCase())) return false
      }
      return true
    })
  }, [batches, pinnedProductId, pinnedVariantId, supplierFilter, statusFilter, search, products])

  // Group filtered batches by deliveryId; solo/legacy batches use their own id as the group key
  const displayGroups = useMemo(() => {
    const groupMap = new Map<string, Batch[]>()
    const keyOrder: string[] = []

    for (const b of filtered) {
      const key = b.deliveryId || b.id
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
        keyOrder.push(key)
      }
      groupMap.get(key)!.push(b)
    }

    return keyOrder.map(key => ({
      key,
      batches: groupMap.get(key)!,
      isDelivery: !!groupMap.get(key)![0].deliveryId,
    }))
  }, [filtered])

  const toggleDelivery = (key: string) => {
    setExpandedDeliveries(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalCostValue = filtered.reduce((sum, b) => sum + b.quantityRemaining * b.costPrice, 0)
  const totalUnitsRemaining = filtered.reduce((sum, b) => sum + b.quantityRemaining, 0)
  const totalReceived = filtered.reduce((sum, b) => sum + b.quantityReceived, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Batch History"
          subtitle="Every stock delivery logged with cost, supplier and remaining units"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={downloadImportTemplate}
            className="flex items-center gap-2 h-10 px-4 bg-white border border-border text-navy rounded-xl font-bold text-[13px] hover:bg-gray-50 transition-colors"
            title="Download Excel template"
          >
            <Download size={15} /> Template
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 h-10 px-4 bg-white border border-border text-navy rounded-xl font-bold text-[13px] hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet size={15} /> Import Excel
          </button>
          <button
            onClick={openMultiModal}
            className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl font-bold text-[13px] hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={15} /> New Batch
          </button>
        </div>
      </div>

      {/* Pinned variant filter banner */}
      {pinnedProductName && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-primary uppercase tracking-wider">Filtered by:</span>
            <span className="text-[13px] font-bold text-navy">{pinnedProductName}</span>
          </div>
          <button
            onClick={() => { setPinnedProductId(undefined); setPinnedVariantId(undefined) }}
            className="p-1.5 text-gray hover:text-navy hover:bg-white rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-xl p-5">
          <p className="text-[11px] font-bold text-gray uppercase tracking-wider">Total Deliveries</p>
          <p className="text-2xl font-bold text-navy mt-1">{displayGroups.length}</p>
          <p className="text-[11px] text-gray/60 mt-0.5">{totalReceived} units received</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5">
          <p className="text-[11px] font-bold text-gray uppercase tracking-wider">Units Remaining</p>
          <p className="text-2xl font-bold text-navy mt-1">{totalUnitsRemaining}</p>
          <p className="text-[11px] text-gray/60 mt-0.5">across active batches</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5">
          <p className="text-[11px] font-bold text-gray uppercase tracking-wider">Stock Cost Value</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatNaira(totalCostValue)}</p>
          <p className="text-[11px] text-gray/60 mt-0.5">at cost price</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product or supplier…"
            className="w-full h-9 pl-8 pr-4 border border-border rounded-lg text-[13px] focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <select
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="h-9 px-3 border border-border rounded-lg text-[13px] focus:outline-none focus:border-primary bg-white"
        >
          {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'depleted'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-md text-[12px] font-bold capitalize transition-all',
                statusFilter === s ? 'bg-white text-navy shadow-sm' : 'text-gray hover:text-navy'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white border border-border rounded-xl py-20 text-center text-gray/40 text-[13px]">Loading batches…</div>
        ) : displayGroups.length === 0 ? (
          <div className="bg-white border border-border rounded-xl py-20 text-center">
            <Archive size={36} className="text-gray/20 mx-auto mb-3" />
            <p className="text-[13px] text-gray/50 italic">No batches found</p>
          </div>
        ) : (
          displayGroups.map(({ key, batches: groupBatches, isDelivery }) => {
            const isExpanded = expandedDeliveries.has(key)
            const first = groupBatches[0]
            const groupTotalUnits = groupBatches.reduce((s, b) => s + b.quantityReceived, 0)
            const groupRemaining = groupBatches.reduce((s, b) => s + b.quantityRemaining, 0)
            const groupCost = groupBatches.reduce((s, b) => s + b.quantityRemaining * b.costPrice, 0)
            const allDepleted = groupBatches.every(b => b.quantityRemaining === 0)

            return (
              <div key={key} className={cn('bg-white border border-border rounded-xl overflow-hidden', allDepleted && 'opacity-60')}>
                {/* Delivery header row */}
                <button
                  type="button"
                  onClick={() => toggleDelivery(key)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="shrink-0 text-gray/40">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>

                  <div className="w-9 h-9 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <Truck size={16} className="text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[14px] font-bold text-navy">
                        {new Date(first.receivedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {first.supplier && (
                        <span className="text-[12px] font-bold text-primary bg-primary/5 border border-primary/15 px-2 py-0.5 rounded-full">
                          {first.supplier}
                        </span>
                      )}
                      {isDelivery && (
                        <span className="text-[11px] text-gray/50">{groupBatches.length} items</span>
                      )}
                      {first.notes && (
                        <span className="text-[12px] text-gray/50 italic truncate max-w-[200px]">{first.notes}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-gray/50">{groupTotalUnits} units received</span>
                      <span className="text-[11px] text-gray/50">·</span>
                      <span className={cn('text-[11px] font-medium', allDepleted ? 'text-gray/40' : 'text-navy')}>
                        {groupRemaining} remaining
                      </span>
                      {allDepleted && (
                        <span className="text-[10px] font-bold text-gray/40 uppercase tracking-wider">Depleted</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[14px] font-bold text-primary">{formatNaira(groupCost)}</span>
                    <p className="text-[11px] text-gray/40">cost value</p>
                  </div>
                </button>
                <div className="shrink-0 mr-3 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); openDeliveryEdit(key, groupBatches) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Edit whole delivery"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDeletingDelivery({ key, batches: groupBatches }) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete whole delivery"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded: individual batch lines */}
                {isExpanded && (
                  <div className="border-t border-border">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr className="text-[10px] text-gray font-bold uppercase tracking-wider text-left">
                          <th className="px-5 py-2.5">Product</th>
                          <th className="px-5 py-2.5 text-center">Qty In</th>
                          <th className="px-5 py-2.5 text-center">Remaining</th>
                          <th className="px-5 py-2.5 text-right">Cost / Unit</th>
                          <th className="px-5 py-2.5 text-right">Sell Price</th>
                          <th className="px-5 py-2.5 text-left">Notes</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {groupBatches.map(b => {
                          const isDepleted = b.quantityRemaining === 0
                          const pctSold = b.quantityReceived > 0
                            ? Math.round(((b.quantityReceived - b.quantityRemaining) / b.quantityReceived) * 100)
                            : 0

                          return (
                            <tr key={b.id} className={cn('text-[13px] hover:bg-gray-50/60 transition-colors group', isDepleted && 'opacity-40')}>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-primary/5 rounded-md flex items-center justify-center text-primary shrink-0 border border-primary/10">
                                    {(() => { const p = products.find(x => x.id === b.productId); return getProductIcon(p?.category || 'Accessories', p?.name || '', 14) })()}
                                  </div>
                                  <span className="font-semibold text-navy">{getProductName(b.productId, b.variantId)}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center font-bold text-navy">{b.quantityReceived}</td>
                              <td className="px-5 py-3">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={cn('font-bold', isDepleted ? 'text-gray/40' : 'text-navy')}>{b.quantityRemaining}</span>
                                  <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={cn('h-full rounded-full transition-all', isDepleted ? 'bg-gray-300' : pctSold > 80 ? 'bg-amber-400' : 'bg-primary')}
                                      style={{ width: `${100 - pctSold}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right font-bold text-orange-600">{formatNaira(b.costPrice)}</td>
                              <td className="px-5 py-3 text-right">
                                {b.sellPrice
                                  ? <span className="font-bold text-primary">{formatNaira(b.sellPrice)}</span>
                                  : <span className="text-gray/40 text-[12px]">—</span>}
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-gray/50 italic text-[12px]">{b.notes || '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openSingleEdit(b)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray hover:text-primary hover:bg-primary/5 transition-colors"
                                    title="Edit this batch"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingBatch(b)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Delete this batch"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Single Batch Edit Modal */}
      {editingSingle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setEditingSingle(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[460px] animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="h-1 w-full bg-primary" />
            <form onSubmit={handleSaveSingleEdit} className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-navy">Edit Batch</h3>
                  <p className="text-[12px] text-gray mt-0.5">{getProductName(editingSingle.productId, editingSingle.variantId)}</p>
                </div>
                <button type="button" onClick={() => setEditingSingle(null)} className="p-1.5 text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Qty Received</label>
                  <input
                    type="number" required
                    min={editingSingle.quantityReceived - editingSingle.quantityRemaining}
                    value={singleQty} onChange={e => setSingleQty(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold focus:border-primary outline-none"
                  />
                  {Number(singleQty) !== editingSingle.quantityReceived && (
                    <p className="text-[11px] text-amber-600 font-medium">
                      Stock will {Number(singleQty) > editingSingle.quantityReceived ? 'increase' : 'decrease'} by {Math.abs(Number(singleQty) - editingSingle.quantityReceived)} units
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Date Received</label>
                  <input type="date" required value={singleDate} onChange={e => setSingleDate(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Cost Price (₦)</label>
                  <input type="number" min={0} required value={singleCostPrice} onChange={e => setSingleCostPrice(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-orange-600 focus:border-primary outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Sell Price (₦)</label>
                  <input type="number" min={0} value={singleSellPrice} onChange={e => setSingleSellPrice(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-primary focus:border-primary outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Supplier</label>
                <select value={singleSupplier} onChange={e => setSingleSupplier(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none">
                  <option value="">No supplier</option>
                  {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Notes</label>
                <input value={singleNotes} onChange={e => setSingleNotes(e.target.value)} placeholder="Optional notes…" className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingSingle(null)} className="flex-1 h-11 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors disabled:opacity-60">
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Delivery Modal */}
      {editingDelivery && (() => {
        const productGroups = Array.from(
          editDeliveryLines.reduce((map, line) => {
            if (!map.has(line.productId)) map.set(line.productId, [] as typeof editDeliveryLines)
            map.get(line.productId)!.push(line)
            return map
          }, new Map<string, typeof editDeliveryLines>())
        )
        const totalUnitsEdit = editDeliveryLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setEditingDelivery(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="h-1 w-full bg-primary shrink-0" />

              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
                <div>
                  <h3 className="text-[17px] font-bold text-navy">Edit Delivery</h3>
                  <p className="text-[12px] text-gray mt-0.5">
                    {editingDelivery.batches.length} item{editingDelivery.batches.length !== 1 ? 's' : ''} in this delivery
                  </p>
                </div>
                <button onClick={() => setEditingDelivery(null)} className="p-1.5 text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveDeliveryEdit} className="flex flex-col flex-1 overflow-hidden">
                {/* Common delivery fields */}
                <div className="px-6 py-4 border-b border-border shrink-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Supplier</label>
                      <select value={editDeliverySupplier} onChange={e => setEditDeliverySupplier(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none">
                        <option value="">No supplier</option>
                        {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Date Received</label>
                      <input type="date" required value={editDeliveryDate} onChange={e => setEditDeliveryDate(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Notes <span className="text-gray/40 normal-case font-normal">(applies to whole delivery)</span></label>
                      <input value={editDeliveryNotes} onChange={e => setEditDeliveryNotes(e.target.value)} placeholder="Optional notes…" className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                    </div>
                  </div>
                </div>

                {/* Product groups — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
                  <p className="text-[11px] font-bold text-gray uppercase tracking-wider mb-1">Items in this delivery</p>

                  {productGroups.map(([productId, lines]) => {
                    const prod = products.find(p => p.id === productId)
                    const isVariant = lines.some(l => l.variantId)
                    const pvariants = prod?.variants || []

                    return (
                      <div key={productId} className="bg-gray-50 border border-border rounded-xl overflow-hidden">
                        {/* Product header */}
                        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-white">
                          <div className="w-7 h-7 bg-primary/5 rounded-md flex items-center justify-center text-primary shrink-0 border border-primary/10">
                            {getProductIcon(prod?.category || 'Accessories', prod?.name || '', 14)}
                          </div>
                          <span className="text-[13px] font-bold text-navy">{prod?.name || productId}</span>
                        </div>

                        {isVariant ? (() => {
                          const dim: 'storage' | 'ram' | null =
                            pvariants.some(v => v.storage) ? 'storage' :
                            pvariants.some(v => v.ram) ? 'ram' : null
                          const getDimVal = (v: typeof pvariants[0]) =>
                            dim === 'storage' ? v.storage : dim === 'ram' ? v.ram : undefined
                          const groups = dim
                            ? [...new Set(pvariants.map(getDimVal).filter(Boolean))] as string[]
                            : []

                          return (
                            <div className="divide-y divide-gray-100">
                              {groups.length > 0 && (
                                <div className="px-3 py-3 bg-primary/5 space-y-2">
                                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Set price by {dim}</p>
                                  <div className="grid grid-cols-[70px_1fr_1fr] gap-2 px-0.5">
                                    <span className="text-[9px] font-bold text-gray/40 uppercase">{dim}</span>
                                    <span className="text-[9px] font-bold text-gray/40 uppercase">Cost ₦</span>
                                    <span className="text-[9px] font-bold text-gray/40 uppercase">Sell ₦</span>
                                  </div>
                                  {groups.map(group => {
                                    const batchIds = lines
                                      .filter(l => {
                                        const v = pvariants.find(pv => pv.id === l.variantId)
                                        return v && getDimVal(v) === group
                                      })
                                      .map(l => l.batchId)
                                    return (
                                      <div key={group} className="grid grid-cols-[70px_1fr_1fr] gap-2 items-center">
                                        <span className="text-[13px] font-bold text-navy">{group}</span>
                                        <input
                                          type="number" min={0} placeholder="Cost"
                                          className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-orange-600 focus:border-primary outline-none bg-white"
                                          onChange={e => { if (e.target.value) bulkUpdateEditLines(batchIds, 'costPrice', e.target.value) }}
                                        />
                                        <input
                                          type="number" min={0} placeholder="Sell"
                                          className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-primary focus:border-primary outline-none bg-white"
                                          onChange={e => { if (e.target.value) bulkUpdateEditLines(batchIds, 'sellPrice', e.target.value) }}
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              <div className="grid grid-cols-[1fr_80px_110px_110px] gap-2 px-3 py-1.5 bg-gray-100/60">
                                <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Variant</span>
                                <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Qty</span>
                                <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Cost ₦</span>
                                <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Sell ₦</span>
                              </div>

                              {lines.map(line => {
                                const minQty = line.originalQtyReceived - line.originalQtyRemaining
                                const qtyChanged = !line.isNew && Number(line.quantity) !== line.originalQtyReceived
                                return (
                                  <div key={line.batchId} className={cn(
                                    'grid grid-cols-[1fr_80px_110px_110px] gap-2 px-3 py-2 items-center',
                                    line.isNew ? 'bg-emerald-50/60' : Number(line.quantity) > 0 ? 'bg-white' : ''
                                  )}>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[12px] font-semibold text-navy truncate">{line.label}</span>
                                        {line.isNew && (
                                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0">New</span>
                                        )}
                                      </div>
                                      {qtyChanged && (
                                        <span className="text-[10px] text-amber-600 font-medium">
                                          {Number(line.quantity) > line.originalQtyReceived ? '+' : ''}{Number(line.quantity) - line.originalQtyReceived} units
                                        </span>
                                      )}
                                    </div>
                                    <input
                                      type="number" min={line.isNew ? 0 : minQty} value={line.quantity}
                                      onChange={e => updateEditLine(line.batchId, 'quantity', e.target.value)}
                                      placeholder="0"
                                      className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-center focus:border-primary outline-none bg-gray-50"
                                    />
                                    <input
                                      type="number" min={0} value={line.costPrice}
                                      onChange={e => updateEditLine(line.batchId, 'costPrice', e.target.value)}
                                      placeholder="Cost"
                                      className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-orange-600 focus:border-primary outline-none bg-gray-50"
                                    />
                                    <input
                                      type="number" min={0} value={line.sellPrice}
                                      onChange={e => updateEditLine(line.batchId, 'sellPrice', e.target.value)}
                                      placeholder="Sell"
                                      className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-primary focus:border-primary outline-none bg-gray-50"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })() : (
                          lines.map(line => {
                            const minQty = line.originalQtyReceived - line.originalQtyRemaining
                            const qtyChanged = Number(line.quantity) !== line.originalQtyReceived
                            return (
                              <div key={line.batchId} className="p-3 space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray/50 uppercase tracking-wide">Qty</label>
                                    <input type="number" min={minQty} value={line.quantity}
                                      onChange={e => updateEditLine(line.batchId, 'quantity', e.target.value)}
                                      className="w-full h-9 px-3 bg-white border border-border rounded-lg text-[13px] font-bold focus:border-primary outline-none" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray/50 uppercase tracking-wide">Cost ₦</label>
                                    <input type="number" min={0} value={line.costPrice}
                                      onChange={e => updateEditLine(line.batchId, 'costPrice', e.target.value)}
                                      placeholder="0"
                                      className="w-full h-9 px-3 bg-white border border-border rounded-lg text-[13px] font-bold text-orange-600 focus:border-primary outline-none" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray/50 uppercase tracking-wide">Sell ₦</label>
                                    <input type="number" min={0} value={line.sellPrice}
                                      onChange={e => updateEditLine(line.batchId, 'sellPrice', e.target.value)}
                                      placeholder="0"
                                      className="w-full h-9 px-3 bg-white border border-border rounded-lg text-[13px] font-bold text-primary focus:border-primary outline-none" />
                                  </div>
                                </div>
                                {qtyChanged && (
                                  <p className="text-[10px] text-amber-600 font-medium">
                                    Stock will {Number(line.quantity) > line.originalQtyReceived ? 'increase' : 'decrease'} by {Math.abs(Number(line.quantity) - line.originalQtyReceived)} units
                                  </p>
                                )}
                                {line.costPrice && line.sellPrice && Number(line.costPrice) > 0 && Number(line.sellPrice) > 0 && (
                                  <p className="text-[10px] text-emerald-600 font-bold">
                                    {(((Number(line.sellPrice) - Number(line.costPrice)) / Number(line.sellPrice)) * 100).toFixed(1)}% margin · {formatNaira(Number(line.sellPrice) - Number(line.costPrice))}/unit
                                  </p>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0">
                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-navy">
                      {editingDelivery.batches.length} item{editingDelivery.batches.length !== 1 ? 's' : ''} · {totalUnitsEdit} units
                    </p>
                    {editDeliverySupplier && <p className="text-[11px] text-gray/50">{editDeliverySupplier}</p>}
                  </div>
                  <button type="button" onClick={() => setEditingDelivery(null)} className="h-11 px-5 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="h-11 px-6 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
                  >
                    {isSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* Delete Confirm Modal */}
      {deletingBatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setDeletingBatch(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="text-[16px] font-bold text-navy">Delete this batch?</h3>
              <p className="text-[13px] text-gray mt-1">
                {getProductName(deletingBatch.productId, deletingBatch.variantId)}
              </p>
              {deletingBatch.quantityRemaining > 0 && (
                <p className="text-[12px] font-bold text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {deletingBatch.quantityRemaining} unsold units will be deducted from stock
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingBatch(null)} className="flex-1 h-11 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={isDeleting} className="flex-1 h-11 bg-red-500 text-white rounded-xl font-bold text-[14px] hover:bg-red-600 transition-colors disabled:opacity-60">
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Delivery Confirm Modal */}
      {deletingDelivery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setDeletingDelivery(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] animate-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <div className="text-center">
              <h3 className="text-[16px] font-bold text-navy">Delete entire delivery?</h3>
              <p className="text-[13px] text-gray mt-1">
                {deletingDelivery.batches.length} item{deletingDelivery.batches.length !== 1 ? 's' : ''} will be removed
              </p>
              {deletingDelivery.batches.some(b => b.quantityRemaining > 0) && (
                <p className="text-[12px] font-bold text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {deletingDelivery.batches.reduce((s, b) => s + b.quantityRemaining, 0)} unsold units will be deducted from stock
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingDelivery(null)} className="flex-1 h-11 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleConfirmDeleteDelivery} disabled={isDeletingDelivery} className="flex-1 h-11 bg-red-500 text-white rounded-xl font-bold text-[14px] hover:bg-red-600 transition-colors disabled:opacity-60">
                {isDeletingDelivery ? 'Deleting…' : 'Delete Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportOpen && (
        <ExcelImport
          products={products}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {/* Multi-product Batch Receive Modal */}
      {isMultiOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setIsMultiOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="h-1 w-full bg-primary shrink-0" />

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div>
                <h3 className="text-[17px] font-bold text-navy">New Batch Delivery</h3>
                <p className="text-[12px] text-gray mt-0.5">All items below will be grouped as one delivery</p>
              </div>
              <button onClick={() => setIsMultiOpen(false)} className="p-1.5 text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMultiSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Common delivery fields */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Supplier</label>
                    <select value={multiSupplier} onChange={e => setMultiSupplier(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none">
                      <option value="">Select supplier…</option>
                      {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Date Received</label>
                    <input type="date" required value={multiDate} onChange={e => setMultiDate(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Notes <span className="text-gray/40 normal-case font-normal">(applies to whole delivery)</span></label>
                    <input value={multiNotes} onChange={e => setMultiNotes(e.target.value)} placeholder="e.g. March shipment from Alaba market…" className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                  </div>
                </div>
              </div>

              {/* Line items — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 no-scrollbar">
                <p className="text-[11px] font-bold text-gray uppercase tracking-wider mb-1">Items in this delivery</p>

                {lineItems.map((line, idx) => {
                  const isVariantProduct = line.variantLines.length > 0

                  return (
                    <div key={line.key} className="bg-gray-50 border border-border rounded-xl overflow-hidden">
                      {/* Card header: item number + product selector + remove */}
                      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
                        <span className="text-[10px] font-bold text-gray/40 uppercase tracking-widest w-10 shrink-0">#{idx + 1}</span>
                        <select
                          value={line.productId}
                          onChange={e => selectProduct(line.key, e.target.value, products)}
                          className="flex-1 h-9 px-3 bg-white border border-border rounded-lg text-[13px] focus:border-primary outline-none"
                        >
                          <option value="">Select product…</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLine(line.key)} className="p-1.5 text-gray/40 hover:text-red-500 rounded-lg transition-colors shrink-0">
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Variant product */}
                      {isVariantProduct && (() => {
                        const prod = products.find(p => p.id === line.productId)
                        const pvariants = prod?.variants || []
                        const dim: 'storage' | 'ram' | null =
                          pvariants.some(v => v.storage) ? 'storage' :
                          pvariants.some(v => v.ram) ? 'ram' : null
                        const getDimVal = (v: typeof pvariants[0]) =>
                          dim === 'storage' ? v.storage : dim === 'ram' ? v.ram : undefined
                        const groups = dim
                          ? [...new Set(pvariants.map(getDimVal).filter(Boolean))] as string[]
                          : []

                        return (
                          <div className="divide-y divide-gray-100">
                            {/* Price group setters */}
                            {groups.length > 0 && (
                              <div className="px-3 py-3 bg-primary/5 space-y-2">
                                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                  Set price by {dim}
                                </p>
                                <div className="grid grid-cols-[70px_1fr_1fr] gap-2 px-0.5">
                                  <span className="text-[9px] font-bold text-gray/40 uppercase">{dim}</span>
                                  <span className="text-[9px] font-bold text-gray/40 uppercase">Cost ₦</span>
                                  <span className="text-[9px] font-bold text-gray/40 uppercase">Sell ₦</span>
                                </div>
                                {groups.map(group => {
                                  const ids = pvariants.filter(v => getDimVal(v) === group).map(v => v.id)
                                  return (
                                    <div key={group} className="grid grid-cols-[70px_1fr_1fr] gap-2 items-center">
                                      <span className="text-[13px] font-bold text-navy">{group}</span>
                                      <input
                                        type="number" min={0} placeholder="Cost"
                                        className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-orange-600 focus:border-primary outline-none bg-white"
                                        onChange={e => { if (e.target.value) ids.forEach(id => updateVariantLine(line.key, id, 'costPrice', e.target.value)) }}
                                      />
                                      <input
                                        type="number" min={0} placeholder="Sell"
                                        className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-primary focus:border-primary outline-none bg-white"
                                        onChange={e => { if (e.target.value) ids.forEach(id => updateVariantLine(line.key, id, 'sellPrice', e.target.value)) }}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_80px_110px_110px] gap-2 px-3 py-1.5 bg-gray-100/60">
                              <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Variant</span>
                              <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Qty</span>
                              <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Cost ₦</span>
                              <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Sell ₦</span>
                            </div>

                            {/* Per-variant qty + override */}
                            {line.variantLines.map(vl => (
                              <div key={vl.variantId} className={cn('grid grid-cols-[1fr_80px_110px_110px] gap-2 px-3 py-2 items-center', Number(vl.quantity) > 0 ? 'bg-white' : '')}>
                                <span className="text-[12px] font-semibold text-navy truncate">{vl.label}</span>
                                <input
                                  type="number" min={0} value={vl.quantity}
                                  onChange={e => updateVariantLine(line.key, vl.variantId, 'quantity', e.target.value)}
                                  placeholder="0"
                                  className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-center focus:border-primary outline-none bg-gray-50"
                                />
                                <input
                                  type="number" min={0} value={vl.costPrice}
                                  onChange={e => updateVariantLine(line.key, vl.variantId, 'costPrice', e.target.value)}
                                  placeholder="Cost"
                                  className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-orange-600 focus:border-primary outline-none bg-gray-50"
                                />
                                <input
                                  type="number" min={0} value={vl.sellPrice}
                                  onChange={e => updateVariantLine(line.key, vl.variantId, 'sellPrice', e.target.value)}
                                  placeholder="Sell"
                                  className="w-full h-8 px-2 border border-border rounded-lg text-[12px] font-bold text-primary focus:border-primary outline-none bg-gray-50"
                                />
                              </div>
                            ))}

                            <div className="px-3 py-1.5 bg-gray-50 flex items-center gap-3">
                              <span className="text-[10px] text-gray/40 italic">Leave qty at 0 to skip a variant</span>
                              {line.variantLines.some(vl => Number(vl.quantity) > 0) && (
                                <span className="text-[10px] font-bold text-primary ml-auto">
                                  {line.variantLines.reduce((s, vl) => s + (Number(vl.quantity) || 0), 0)} units total
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Simple product */}
                      {!isVariantProduct && line.productId && (
                        <div className="p-3 space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray/50 uppercase tracking-wide">Qty</label>
                              <input type="number" min={1} value={line.quantity}
                                onChange={e => updateLineField(line.key, 'quantity', e.target.value)}
                                className="w-full h-9 px-3 bg-white border border-border rounded-lg text-[13px] font-bold focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray/50 uppercase tracking-wide">Cost ₦</label>
                              <input type="number" min={0} value={line.costPrice}
                                onChange={e => updateLineField(line.key, 'costPrice', e.target.value)}
                                placeholder="0"
                                className="w-full h-9 px-3 bg-white border border-border rounded-lg text-[13px] font-bold text-orange-600 focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray/50 uppercase tracking-wide">Sell ₦</label>
                              <input type="number" min={0} value={line.sellPrice}
                                onChange={e => updateLineField(line.key, 'sellPrice', e.target.value)}
                                placeholder="0"
                                className="w-full h-9 px-3 bg-white border border-border rounded-lg text-[13px] font-bold text-primary focus:border-primary outline-none" />
                            </div>
                          </div>
                          {line.costPrice && line.sellPrice && Number(line.costPrice) > 0 && Number(line.sellPrice) > 0 && (
                            <p className="text-[10px] text-emerald-600 font-bold">
                              {(((Number(line.sellPrice) - Number(line.costPrice)) / Number(line.sellPrice)) * 100).toFixed(1)}% margin · {formatNaira(Number(line.sellPrice) - Number(line.costPrice))}/unit
                            </p>
                          )}
                        </div>
                      )}

                      {/* Placeholder when no product selected */}
                      {!isVariantProduct && !line.productId && (
                        <div className="flex items-center gap-2 px-3 py-4 text-gray/30">
                          <Package size={14} />
                          <span className="text-[12px] italic">Select a product above</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={addLine}
                  className="w-full h-10 border-2 border-dashed border-border rounded-xl text-[13px] font-bold text-gray/50 hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Add another product
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0">
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-navy">1 delivery · {itemCount} item{itemCount !== 1 ? 's' : ''} · {totalUnitsToReceive} units</p>
                  {multiSupplier && <p className="text-[11px] text-gray/50">{multiSupplier}</p>}
                </div>
                <button type="button" onClick={() => setIsMultiOpen(false)} className="h-11 px-5 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMulti || itemCount === 0}
                  className="h-11 px-6 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
                >
                  {isSubmittingMulti ? 'Receiving…' : 'Receive Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
