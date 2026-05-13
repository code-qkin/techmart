import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useSuppliers } from '../hooks/useSuppliers'
import { useProducts } from '../hooks/useProducts'
import { useBatches } from '../hooks/useBatches'
import { useOrders } from '../hooks/useOrders'
import { getStockStatus, formatNaira } from '../lib/utils'
import { Plus, Trash2, Truck, Search, ChevronDown, ChevronRight, Package, Tag, User, Phone, Mail, MapPin, FileText, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import type { Supplier } from '../types'

const StatusPill = ({ status }: { status: 'in' | 'low' | 'out' }) => {
  if (status === 'out') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-200">Out of stock</span>
  if (status === 'low') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-200">Low stock</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">In stock</span>
}

const emptyForm = (): Omit<Supplier, 'name'> & { name: string } => ({
  name: '', location: '', phone: '', email: '', contactPerson: '', notes: '',
})

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, removeSupplier } = useSuppliers()
  const { products } = useProducts()
  const { batches } = useBatches()
  const { orders } = useOrders()

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedVariantKey, setExpandedVariantKey] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null) // null = adding new
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.location?.toLowerCase().includes(search.toLowerCase()) ||
    s.contactPerson?.toLowerCase().includes(search.toLowerCase())
  )

  const imeiOrderMap = useMemo(() => {
    const map = new Map<string, { customerName: string; customerPhone: string; orderId: string; soldAt: string }>()
    for (const order of orders) {
      for (const item of order.items) {
        if (item.imei) {
          map.set(item.imei, {
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            orderId: order.id,
            soldAt: order.createdAt,
          })
        }
      }
    }
    return map
  }, [orders])

  const getSupplierProducts = (name: string) => {
    const batchProductIds = new Set(
      batches.filter(b => b.supplier === name).map(b => b.productId)
    )
    return products.filter(p => {
      if (batchProductIds.has(p.id)) return true
      if (p.supplier === name) return true
      return p.variants?.some(v => v.units?.some(u => u.supplier === name))
    })
  }

  const getSupplierBatches = (supplierName: string, productId: string) =>
    batches.filter(b => b.supplier === supplierName && b.productId === productId)

  const getSuppliedVariants = (supplierName: string, productId: string, allVariants: NonNullable<typeof products[0]['variants']>) => {
    const suppliedIds = new Set(
      batches
        .filter(b => b.supplier === supplierName && b.productId === productId && b.variantId)
        .map(b => b.variantId!)
    )
    return allVariants.filter(v => suppliedIds.has(v.id))
  }

  const openAdd = () => {
    setEditingName(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditingName(supplier.name)
    setForm({
      name: supplier.name,
      location: supplier.location || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      contactPerson: supplier.contactPerson || '',
      notes: supplier.notes || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingName(null)
    setForm(emptyForm())
  }

  const handleSave = async () => {
    const name = form.name.trim()
    if (!name) return

    if (!editingName && suppliers.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A supplier with that name already exists')
      return
    }

    setSaving(true)
    try {
      if (editingName) {
        await updateSupplier({ ...form, name: editingName })
        toast.success('Supplier updated')
      } else {
        await addSupplier({ ...form, name })
        toast.success(`"${name}" added`)
      }
      closeModal()
    } catch {
      toast.error(editingName ? 'Failed to update supplier' : 'Failed to add supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (name: string) => {
    try {
      await removeSupplier(name)
      setDeletingName(null)
      if (expanded === name) setExpanded(null)
      toast.success(`"${name}" removed`)
    } catch {
      toast.error('Failed to remove supplier')
    }
  }

  const toggleVariantKey = (key: string) =>
    setExpandedVariantKey(prev => prev === key ? null : key)

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Manage your supplier contacts — details appear across inventory and batches"
        action={
          <button
            onClick={openAdd}
            className="h-10 px-5 bg-primary text-white rounded-xl font-bold text-[13px] hover:bg-primary-dark flex items-center gap-2 transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={15} /> Add Supplier
          </button>
        }
      />

      {/* Search */}
      <div className="bg-white border border-border rounded-xl p-5 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, location or contact…"
            className="w-full h-9 pl-8 pr-4 border border-border rounded-lg text-[13px] focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <span className="text-[12px] text-gray/50 font-medium ml-auto">
          {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Supplier list */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Truck size={36} className="text-gray/20 mx-auto mb-3" />
            <p className="text-[13px] text-gray/50 italic">
              {search ? 'No suppliers match your search' : 'No suppliers yet — add one above'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((supplier) => {
              const { name } = supplier
              const supplierProducts = getSupplierProducts(name)
              const isExpanded = expanded === name
              const totalUnits = supplierProducts.reduce((sum, p) => {
                if (p.variants?.length) return sum + p.variants.reduce((s, v) => s + v.stock, 0)
                return sum + p.stock
              }, 0)
              const totalBatches = batches.filter(b => b.supplier === name).length

              return (
                <li key={name} className="group">
                  {/* Supplier row */}
                  <div className="flex items-start justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors gap-4">
                    <button
                      onClick={() => { setExpanded(isExpanded ? null : name); setExpandedVariantKey(null) }}
                      className="flex items-start gap-3 flex-1 text-left min-w-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Truck size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[14px] font-bold text-navy">{name}</span>
                        {/* Details row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          {supplier.location && (
                            <span className="flex items-center gap-1 text-[11px] text-gray/60">
                              <MapPin size={10} className="shrink-0" /> {supplier.location}
                            </span>
                          )}
                          {supplier.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-gray/60">
                              <Phone size={10} className="shrink-0" /> {supplier.phone}
                            </span>
                          )}
                          {supplier.email && (
                            <span className="flex items-center gap-1 text-[11px] text-gray/60">
                              <Mail size={10} className="shrink-0" /> {supplier.email}
                            </span>
                          )}
                          {supplier.contactPerson && (
                            <span className="flex items-center gap-1 text-[11px] text-gray/60">
                              <User size={10} className="shrink-0" /> {supplier.contactPerson}
                            </span>
                          )}
                        </div>
                        {/* Stats row */}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[11px] text-gray/40">
                            {supplierProducts.length === 0 ? 'no products' : `${supplierProducts.length} product${supplierProducts.length !== 1 ? 's' : ''}`}
                          </span>
                          {totalUnits > 0 && <span className="text-[11px] text-gray/40">{totalUnits} units in stock</span>}
                          {totalBatches > 0 && <span className="text-[11px] text-gray/40">{totalBatches} batch{totalBatches !== 1 ? 'es' : ''}</span>}
                        </div>
                      </div>
                      <span className="text-gray/30 shrink-0 mt-2">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {deletingName === name ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-150">
                          <span className="text-[12px] text-gray">Remove?</span>
                          <button onClick={() => handleDelete(name)} className="px-3 py-1.5 bg-red-500 text-white text-[12px] font-bold rounded-lg hover:bg-red-600 transition-colors">Yes</button>
                          <button onClick={() => setDeletingName(null)} className="px-3 py-1.5 border border-border text-[12px] font-bold rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(supplier)}
                            className="p-2 rounded-lg text-gray/40 hover:text-primary hover:bg-primary/5 transition-all"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingName(name)}
                            className="p-2 rounded-lg text-gray/40 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes banner if present */}
                  {isExpanded && supplier.notes && (
                    <div className="mx-6 mb-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <FileText size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-700">{supplier.notes}</p>
                    </div>
                  )}

                  {/* Expanded products */}
                  {isExpanded && (
                    <div className="bg-gray-50/60 border-t border-border px-6 py-5 animate-in slide-in-from-top-1 duration-150 space-y-4">
                      {supplierProducts.length === 0 ? (
                        <div className="flex items-center gap-2 py-3 text-gray/40">
                          <Package size={15} />
                          <span className="text-[13px] italic">No products linked to this supplier yet</span>
                        </div>
                      ) : supplierProducts.map(p => {
                        const supplierBatchList = getSupplierBatches(name, p.id)
                        const totalReceived = supplierBatchList.reduce((s, b) => s + b.quantityReceived, 0)
                        const totalRemaining = supplierBatchList.reduce((s, b) => s + b.quantityRemaining, 0)
                        const suppliedVariants = p.variants?.length
                          ? getSuppliedVariants(name, p.id, p.variants)
                          : []

                        return (
                          <div key={p.id} className="bg-white border border-border rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                              <span className="text-2xl">{p.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold text-navy">{p.name}</p>
                                <p className="text-[11px] text-gray/60">{p.brand} · {p.category}</p>
                              </div>
                              {totalReceived > 0 && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-gray/50 font-medium">{supplierBatchList.length} batch{supplierBatchList.length !== 1 ? 'es' : ''}</span>
                                  <span className="text-[11px] font-bold text-navy bg-gray-100 px-2 py-0.5 rounded-full">{totalReceived} received</span>
                                  <span className="text-[11px] font-bold text-primary bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-full">{totalRemaining} remaining</span>
                                </div>
                              )}
                            </div>

                            {suppliedVariants.length > 0 ? (
                              <div className="divide-y divide-gray-100">
                                {suppliedVariants.map((v) => {
                                  const vKey = `${p.id}:${v.id}`
                                  const isVariantExpanded = expandedVariantKey === vKey
                                  const status = getStockStatus(v.stock, p.lowStockThreshold)
                                  const variantBatches = supplierBatchList.filter(b => b.variantId === v.id)
                                  const variantReceived = variantBatches.reduce((s, b) => s + b.quantityReceived, 0)
                                  const variantLabel = v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' · ')
                                  const imeiUnits = (v.units || []).filter(u => u.imei)

                                  return (
                                    <div key={v.id}>
                                      <button
                                        onClick={() => toggleVariantKey(vKey)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={cn('transition-transform duration-150 text-gray/40 shrink-0', isVariantExpanded && 'rotate-90')}>
                                            <ChevronRight size={14} />
                                          </span>
                                          <span className="text-[13px] font-semibold text-navy truncate">{variantLabel}</span>
                                          {variantReceived > 0 && <span className="text-[10px] text-gray/40 shrink-0">{variantReceived} supplied</span>}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                          <span className={cn('text-[13px] font-bold', status === 'out' ? 'text-red-500' : status === 'low' ? 'text-amber-500' : 'text-navy')}>
                                            {v.stock} units
                                          </span>
                                          <StatusPill status={status} />
                                        </div>
                                      </button>

                                      {isVariantExpanded && (
                                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 animate-in slide-in-from-top-1 duration-150">
                                          {imeiUnits.length === 0 ? (
                                            <p className="text-[12px] text-gray/40 italic py-2">No IMEI numbers recorded for this variant.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              <div className="grid grid-cols-[1fr_100px_1fr] gap-3 px-2 pb-1">
                                                <span className="text-[10px] font-bold text-gray/50 uppercase tracking-widest flex items-center gap-1"><Tag size={9} /> IMEI / Serial</span>
                                                <span className="text-[10px] font-bold text-gray/50 uppercase tracking-widest">Status</span>
                                                <span className="text-[10px] font-bold text-gray/50 uppercase tracking-widest flex items-center gap-1"><User size={9} /> Sold To</span>
                                              </div>
                                              {imeiUnits.map((unit, ui) => {
                                                const soldInfo = imeiOrderMap.get(unit.imei)
                                                return (
                                                  <div key={ui} className={cn('grid grid-cols-[1fr_100px_1fr] gap-3 items-center px-2 py-2 rounded-lg', soldInfo ? 'bg-red-50/60' : 'bg-emerald-50/40')}>
                                                    <span className="text-[11px] font-mono text-navy font-bold truncate">{unit.imei}</span>
                                                    {soldInfo ? (
                                                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-500"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />Sold</span>
                                                    ) : (
                                                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />In Stock</span>
                                                    )}
                                                    {soldInfo ? (
                                                      <div className="min-w-0">
                                                        <p className="text-[12px] font-bold text-navy truncate">{soldInfo.customerName}</p>
                                                        <p className="text-[10px] text-gray/60">{soldInfo.customerPhone} · {new Date(soldInfo.soldAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                      </div>
                                                    ) : (
                                                      <span className="text-[11px] text-gray/30 italic">—</span>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                              {(() => {
                                                const noImeiCount = variantReceived - imeiUnits.length
                                                if (noImeiCount <= 0) return null
                                                const soldNoImei = variantReceived - variantBatches.reduce((s, b) => s + b.quantityRemaining, 0) - imeiUnits.filter(u => imeiOrderMap.has(u.imei)).length
                                                return (
                                                  <div className="mt-1 px-2 py-2 rounded-lg bg-gray-100 text-[11px] text-gray/50 italic">
                                                    +{noImeiCount} unit{noImeiCount !== 1 ? 's' : ''} with no IMEI recorded
                                                    {soldNoImei > 0 && ` · ~${soldNoImei} likely sold`}
                                                  </div>
                                                )
                                              })()}
                                            </div>
                                          )}
                                          {variantBatches.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                                              <p className="text-[10px] font-bold text-gray/50 uppercase tracking-widest mb-1.5">Batch history</p>
                                              {variantBatches.map(b => (
                                                <div key={b.id} className="flex items-center justify-between text-[11px]">
                                                  <span className="text-gray/60">{new Date(b.receivedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                  <div className="flex items-center gap-3">
                                                    <span className="text-gray/50">{b.quantityReceived} in · {b.quantityRemaining} left</span>
                                                    <span className="font-bold text-orange-600">{formatNaira(b.costPrice)}/unit</span>
                                                    {b.sellPrice && <span className="font-bold text-primary">{formatNaira(b.sellPrice)} sell</span>}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                {suppliedVariants.length > 1 && (
                                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-4">
                                    {(() => {
                                      const inCount = suppliedVariants.filter(v => getStockStatus(v.stock, p.lowStockThreshold) === 'in').length
                                      const lowCount = suppliedVariants.filter(v => getStockStatus(v.stock, p.lowStockThreshold) === 'low').length
                                      const outCount = suppliedVariants.filter(v => getStockStatus(v.stock, p.lowStockThreshold) === 'out').length
                                      return (
                                        <>
                                          {inCount > 0 && <span className="text-[11px] font-bold text-emerald-600">{inCount} in stock</span>}
                                          {lowCount > 0 && <span className="text-[11px] font-bold text-amber-500">{lowCount} low</span>}
                                          {outCount > 0 && <span className="text-[11px] font-bold text-red-500">{outCount} depleted</span>}
                                          <span className="text-[11px] text-gray/40 ml-auto">{suppliedVariants.reduce((s, v) => s + v.stock, 0)} total units</span>
                                        </>
                                      )
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-[12px] text-gray/60">Simple product</span>
                                <div className="flex items-center gap-3">
                                  <span className={cn('text-[13px] font-bold', getStockStatus(p.stock, p.lowStockThreshold) === 'out' ? 'text-red-500' : getStockStatus(p.stock, p.lowStockThreshold) === 'low' ? 'text-amber-500' : 'text-navy')}>
                                    {p.stock} units
                                  </span>
                                  <StatusPill status={getStockStatus(p.stock, p.lowStockThreshold)} />
                                </div>
                              </div>
                            )}

                            {supplierBatchList.length > 0 && suppliedVariants.length === 0 && (
                              <div className="border-t border-gray-100 px-4 py-3">
                                <p className="text-[10px] font-bold text-gray/50 uppercase tracking-widest mb-2">Batch history</p>
                                <div className="space-y-1">
                                  {supplierBatchList.slice(0, 5).map(b => (
                                    <div key={b.id} className="flex items-center justify-between text-[11px]">
                                      <span className="text-gray/60">{new Date(b.receivedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray/50">{b.quantityReceived} in · {b.quantityRemaining} left</span>
                                        <span className="font-bold text-orange-600">{formatNaira(b.costPrice)}/unit</span>
                                      </div>
                                    </div>
                                  ))}
                                  {supplierBatchList.length > 5 && (
                                    <p className="text-[10px] text-gray/40 italic">+{supplierBatchList.length - 5} more batches</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-[15px] font-bold text-navy">
                {editingName ? `Edit — ${editingName}` : 'New Supplier'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray/40 hover:text-gray hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name — read-only when editing */}
              <div>
                <label className="text-[11px] font-bold text-gray/50 uppercase tracking-widest block mb-1.5">
                  Supplier Name <span className="text-red-400">*</span>
                </label>
                {editingName ? (
                  <div className="h-11 px-4 border border-border rounded-xl bg-gray-50 flex items-center text-[14px] font-bold text-navy">
                    {editingName}
                  </div>
                ) : (
                  <input
                    autoFocus
                    placeholder="e.g. Samsung Nigeria"
                    className="w-full h-11 px-4 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors"
                    {...field('name')}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray/50 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <MapPin size={10} /> Location
                  </label>
                  <input
                    placeholder="e.g. Lagos Island"
                    className="w-full h-11 px-4 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors"
                    {...field('location')}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray/50 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <Phone size={10} /> Phone
                  </label>
                  <input
                    placeholder="e.g. 08012345678"
                    className="w-full h-11 px-4 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors"
                    {...field('phone')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray/50 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <Mail size={10} /> Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. sales@supplier.com"
                    className="w-full h-11 px-4 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors"
                    {...field('email')}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray/50 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <User size={10} /> Contact Person
                  </label>
                  <input
                    placeholder="e.g. Mr. Ade"
                    className="w-full h-11 px-4 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors"
                    {...field('contactPerson')}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray/50 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                  <FileText size={10} /> Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Payment terms, delivery notes, etc."
                  className="w-full px-4 py-3 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors resize-none"
                  {...field('notes')}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={closeModal}
                className="h-10 px-5 border border-border rounded-xl text-[13px] font-bold text-gray hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editingName && !form.name.trim())}
                className="h-10 px-6 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : editingName ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
