import React, { useState, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/shared/PageHeader'
import { useBatches } from '../hooks/useBatches'
import { useProducts } from '../hooks/useProducts'
import { useSuppliers } from '../hooks/useSuppliers'
import { formatNaira } from '../lib/utils'
import { Search, Archive, X, Pencil, Trash2, Plus, Package, ChevronDown, ChevronRight, Truck } from 'lucide-react'
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
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null)
  const [editSupplier, setEditSupplier] = useState('')
  const [editCostPrice, setEditCostPrice] = useState('')
  const [editSellPrice, setEditSellPrice] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirm state
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Multi-product batch receive state
  interface VariantLine { variantId: string; label: string; quantity: string; costPrice: string; sellPrice: string }
  interface LineItem { key: number; productId: string; quantity: string; costPrice: string; sellPrice: string; variantLines: VariantLine[] }

  const makeVariantLines = (p: Product, allBatches: Batch[]): VariantLine[] =>
    (p.variants || []).map(v => {
      const last = allBatches
        .filter(b => b.productId === p.id && b.variantId === v.id)
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())[0]
      return {
        variantId: v.id,
        label: v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' · '),
        quantity: '',
        costPrice: last ? String(last.costPrice) : (v.costPrice ? String(v.costPrice) : (p.costPrice ? String(p.costPrice) : '')),
        sellPrice: last?.sellPrice ? String(last.sellPrice) : (v.price ? String(v.price) : (p.price ? String(p.price) : '')),
      }
    })

  const blankLine = (key: number): LineItem => ({ key, productId: '', quantity: '1', costPrice: '', sellPrice: '', variantLines: [] })

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

  const selectProduct = useCallback((key: number, productId: string, allProducts: Product[], allBatches: Batch[]) => {
    const p = allProducts.find(x => x.id === productId)
    setLineItems(prev => prev.map(l => {
      if (l.key !== key) return l
      if (!p) return { ...l, productId: '', variantLines: [], costPrice: '', sellPrice: '' }
      if ((p.variants?.length || 0) > 0) {
        return { ...l, productId, variantLines: makeVariantLines(p, allBatches), quantity: '', costPrice: '', sellPrice: '' }
      }
      const last = allBatches
        .filter(b => b.productId === p.id && !b.variantId)
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())[0]
      return {
        ...l, productId, variantLines: [],
        costPrice: last ? String(last.costPrice) : (p.costPrice ? String(p.costPrice) : ''),
        sellPrice: last?.sellPrice ? String(last.sellPrice) : (p.price ? String(p.price) : ''),
      }
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
    if (l.variantLines.length > 0) return sum + l.variantLines.filter(vl => Number(vl.quantity) > 0 && vl.costPrice).length
    return sum + (l.productId && l.quantity && l.costPrice ? 1 : 0)
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
          for (const vl of line.variantLines.filter(vl => Number(vl.quantity) > 0 && vl.costPrice)) {
            await receiveBatch({
              productId: line.productId,
              variantId: vl.variantId,
              supplier: multiSupplier || undefined,
              quantity: Number(vl.quantity),
              costPrice: Number(vl.costPrice),
              sellPrice: Number(vl.sellPrice) || undefined,
              notes: multiNotes || undefined,
              receivedAt: new Date(multiDate).toISOString(),
              deliveryId,
            })
          }
        } else if (line.productId && line.quantity && line.costPrice) {
          await receiveBatch({
            productId: line.productId,
            supplier: multiSupplier || undefined,
            quantity: Number(line.quantity),
            costPrice: Number(line.costPrice),
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

  const openEdit = (b: Batch) => {
    setEditingBatch(b)
    setEditSupplier(b.supplier || '')
    setEditCostPrice(String(b.costPrice))
    setEditSellPrice(b.sellPrice ? String(b.sellPrice) : '')
    setEditQty(String(b.quantityReceived))
    setEditNotes(b.notes || '')
    setEditDate(new Date(b.receivedAt).toISOString().split('T')[0])
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBatch) return
    setIsSaving(true)
    try {
      await updateBatch({
        batch: editingBatch,
        supplier: editSupplier || undefined,
        costPrice: Number(editCostPrice),
        sellPrice: Number(editSellPrice) || undefined,
        notes: editNotes || undefined,
        receivedAt: new Date(editDate).toISOString(),
        newQuantityReceived: Number(editQty),
      })
      toast.success('Batch updated')
      setEditingBatch(null)
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

  const getProductName = (productId: string, variantId?: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return productId
    if (!variantId) return product.name
    const variant = product.variants?.find(v => v.id === variantId)
    if (!variant) return product.name
    const variantLabel = variant.label || [variant.color, variant.storage, variant.ram, variant.condition].filter(Boolean).join(' • ')
    return `${product.name} — ${variantLabel}`
  }

  const getProductEmoji = (productId: string) => {
    return products.find(p => p.id === productId)?.emoji || '📦'
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
        <button
          onClick={openMultiModal}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl font-bold text-[13px] hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 shrink-0"
        >
          <Plus size={15} /> New Batch
        </button>
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
                                  <span className="text-base">{getProductEmoji(b.productId)}</span>
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
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openEdit(b)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray hover:text-primary hover:bg-primary/5 transition-colors"
                                    title="Edit batch"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingBatch(b)}
                                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Delete batch"
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

      {/* Edit Batch Modal */}
      {editingBatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setEditingBatch(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[460px] animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="h-1 w-full bg-primary" />
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-navy">Edit Batch</h3>
                  <p className="text-[12px] text-gray mt-0.5">{getProductName(editingBatch.productId, editingBatch.variantId)}</p>
                </div>
                <button type="button" onClick={() => setEditingBatch(null)} className="p-1.5 text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Qty Received *</label>
                  <input
                    type="number"
                    min={editingBatch.quantityReceived - editingBatch.quantityRemaining}
                    required
                    value={editQty}
                    onChange={e => setEditQty(e.target.value)}
                    className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold focus:border-primary outline-none"
                  />
                  {Number(editQty) !== editingBatch.quantityReceived && (
                    <p className="text-[11px] text-amber-600 font-medium">
                      Stock will {Number(editQty) > editingBatch.quantityReceived ? 'increase' : 'decrease'} by {Math.abs(Number(editQty) - editingBatch.quantityReceived)} units
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Date Received</label>
                  <input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Cost Price (₦) *</label>
                  <input type="number" min={0} required value={editCostPrice} onChange={e => setEditCostPrice(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-orange-600 focus:border-primary outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Sell Price (₦)</label>
                  <input type="number" min={0} value={editSellPrice} onChange={e => setEditSellPrice(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-primary focus:border-primary outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Supplier</label>
                <select value={editSupplier} onChange={e => setEditSupplier(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none">
                  <option value="">No supplier</option>
                  {suppliers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Notes</label>
                <input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Optional notes…" className="w-full h-10 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingBatch(null)} className="flex-1 h-11 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors disabled:opacity-60">
                  {isSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                          onChange={e => selectProduct(line.key, e.target.value, products, batches)}
                          className="flex-1 h-9 px-3 bg-white border border-border rounded-lg text-[13px] focus:border-primary outline-none"
                        >
                          <option value="">Select product…</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                          ))}
                        </select>
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLine(line.key)} className="p-1.5 text-gray/40 hover:text-red-500 rounded-lg transition-colors shrink-0">
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Variant product: one row per variant */}
                      {isVariantProduct && (
                        <div className="divide-y divide-gray-100">
                          <div className="grid grid-cols-[1fr_80px_110px_110px] gap-2 px-3 py-1.5 bg-gray-100/60">
                            <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Variant</span>
                            <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Qty</span>
                            <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Cost ₦</span>
                            <span className="text-[9px] font-bold text-gray/50 uppercase tracking-widest">Sell ₦</span>
                          </div>
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
                      )}

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
