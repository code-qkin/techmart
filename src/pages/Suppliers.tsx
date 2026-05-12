import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useSuppliers } from '../hooks/useSuppliers'
import { useProducts } from '../hooks/useProducts'
import { useBatches } from '../hooks/useBatches'
import { useOrders } from '../hooks/useOrders'
import { getStockStatus, formatNaira } from '../lib/utils'
import { Plus, Trash2, Truck, Search, ChevronDown, ChevronRight, Package, Tag, User } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'

const StatusPill = ({ status }: { status: 'in' | 'low' | 'out' }) => {
  if (status === 'out') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500 border border-red-200">Out of stock</span>
  if (status === 'low') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-200">Low stock</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">In stock</span>
}

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, removeSupplier } = useSuppliers()
  const { products } = useProducts()
  const { batches } = useBatches()
  const { orders } = useOrders()
  const [newName, setNewName] = useState('')
  const [search, setSearch] = useState('')
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedVariantKey, setExpandedVariantKey] = useState<string | null>(null)

  const filtered = suppliers.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  )

  // Map IMEI → order info for sold-unit lookup
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

  // Only return variants that have at least one batch from this supplier
  const getSuppliedVariants = (supplierName: string, productId: string, allVariants: NonNullable<typeof products[0]['variants']>) => {
    const suppliedIds = new Set(
      batches
        .filter(b => b.supplier === supplierName && b.productId === productId && b.variantId)
        .map(b => b.variantId!)
    )
    return allVariants.filter(v => suppliedIds.has(v.id))
  }

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (suppliers.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error('A supplier with that name already exists')
      return
    }
    try {
      await addSupplier(name)
      setNewName('')
      toast.success(`"${name}" added`)
    } catch {
      toast.error('Failed to add supplier')
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        subtitle="Manage your supplier list — changes reflect instantly in Inventory"
      />

      {/* Add supplier */}
      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <h3 className="text-[11px] font-bold text-gray uppercase tracking-[0.15em]">Add New Supplier</h3>
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="e.g. Samsung Nigeria, Tecno Official…"
            className="flex-1 h-11 px-4 border border-border rounded-xl text-[14px] focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="h-11 px-6 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Supplier list */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-primary" />
            <span className="font-bold text-navy text-[15px]">All Suppliers</span>
            <span className="text-[12px] text-gray font-medium bg-gray-100 px-2 py-0.5 rounded-full">{suppliers.length}</span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 pl-8 pr-4 border border-border rounded-lg text-[13px] focus:outline-none focus:border-primary transition-colors w-48"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Truck size={36} className="text-gray/20 mx-auto mb-3" />
            <p className="text-[13px] text-gray/50 italic">
              {search ? 'No suppliers match your search' : 'No suppliers yet — add one above'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((name) => {
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
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors">
                    <button
                      onClick={() => { setExpanded(isExpanded ? null : name); setExpandedVariantKey(null) }}
                      className="flex items-center gap-3 flex-1 text-left min-w-0"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Truck size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[14px] font-bold text-navy">{name}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-gray/50">
                            {supplierProducts.length === 0 ? 'no products' : `${supplierProducts.length} product${supplierProducts.length !== 1 ? 's' : ''}`}
                          </span>
                          {totalUnits > 0 && <span className="text-[11px] text-gray/50">{totalUnits} units in stock</span>}
                          {totalBatches > 0 && <span className="text-[11px] text-gray/50">{totalBatches} batch{totalBatches !== 1 ? 'es' : ''}</span>}
                        </div>
                      </div>
                      <span className="text-gray/30 ml-auto shrink-0">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    </button>

                    {deletingName === name ? (
                      <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-150 ml-4">
                        <span className="text-[12px] text-gray">Remove?</span>
                        <button onClick={() => handleDelete(name)} className="px-3 py-1.5 bg-red-500 text-white text-[12px] font-bold rounded-lg hover:bg-red-600 transition-colors">Yes</button>
                        <button onClick={() => setDeletingName(null)} className="px-3 py-1.5 border border-border text-[12px] font-bold rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingName(name)}
                        className="p-2 rounded-lg text-gray/30 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 ml-3 shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

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

                        // Only show variants that have a batch from this supplier
                        const suppliedVariants = p.variants?.length
                          ? getSuppliedVariants(name, p.id, p.variants)
                          : []

                        return (
                          <div key={p.id} className="bg-white border border-border rounded-xl overflow-hidden">
                            {/* Product header */}
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

                            {/* Supplied variants */}
                            {suppliedVariants.length > 0 ? (
                              <div className="divide-y divide-gray-100">
                                {suppliedVariants.map((v) => {
                                  const vKey = `${p.id}:${v.id}`
                                  const isVariantExpanded = expandedVariantKey === vKey
                                  const status = getStockStatus(v.stock, p.lowStockThreshold)
                                  const variantBatches = supplierBatchList.filter(b => b.variantId === v.id)
                                  const variantReceived = variantBatches.reduce((s, b) => s + b.quantityReceived, 0)
                                  const variantLabel = v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' · ')

                                  // Units that have IMEI recorded
                                  const imeiUnits = (v.units || []).filter(u => u.imei)

                                  return (
                                    <div key={v.id}>
                                      {/* Clickable variant row */}
                                      <button
                                        onClick={() => toggleVariantKey(vKey)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={cn(
                                            'transition-transform duration-150 text-gray/40 shrink-0',
                                            isVariantExpanded && 'rotate-90'
                                          )}>
                                            <ChevronRight size={14} />
                                          </span>
                                          <span className="text-[13px] font-semibold text-navy truncate">{variantLabel}</span>
                                          {variantReceived > 0 && (
                                            <span className="text-[10px] text-gray/40 shrink-0">{variantReceived} supplied</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                          <span className={cn(
                                            'text-[13px] font-bold',
                                            status === 'out' ? 'text-red-500' : status === 'low' ? 'text-amber-500' : 'text-navy'
                                          )}>
                                            {v.stock} units
                                          </span>
                                          <StatusPill status={status} />
                                        </div>
                                      </button>

                                      {/* Expanded IMEI detail panel */}
                                      {isVariantExpanded && (
                                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 animate-in slide-in-from-top-1 duration-150">
                                          {imeiUnits.length === 0 ? (
                                            <p className="text-[12px] text-gray/40 italic py-2">
                                              No IMEI numbers recorded for this variant. Go to Inventory → expand the product → click the variant card to add them.
                                            </p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {/* Column headers */}
                                              <div className="grid grid-cols-[1fr_100px_1fr] gap-3 px-2 pb-1">
                                                <span className="text-[10px] font-bold text-gray/50 uppercase tracking-widest flex items-center gap-1"><Tag size={9} /> IMEI / Serial</span>
                                                <span className="text-[10px] font-bold text-gray/50 uppercase tracking-widest">Status</span>
                                                <span className="text-[10px] font-bold text-gray/50 uppercase tracking-widest flex items-center gap-1"><User size={9} /> Sold To</span>
                                              </div>

                                              {imeiUnits.map((unit, ui) => {
                                                const soldInfo = imeiOrderMap.get(unit.imei)
                                                return (
                                                  <div key={ui} className={cn(
                                                    'grid grid-cols-[1fr_100px_1fr] gap-3 items-center px-2 py-2 rounded-lg',
                                                    soldInfo ? 'bg-red-50/60' : 'bg-emerald-50/40'
                                                  )}>
                                                    <span className="text-[11px] font-mono text-navy font-bold truncate">{unit.imei}</span>
                                                    {soldInfo ? (
                                                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                        Sold
                                                      </span>
                                                    ) : (
                                                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                        In Stock
                                                      </span>
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

                                              {/* Units with no IMEI (qty gap) */}
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

                                          {/* Batch summary for this variant */}
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

                                {/* Variant summary footer */}
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
                              // Simple product (no variants) — show stock status row
                              <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-[12px] text-gray/60">Simple product</span>
                                <div className="flex items-center gap-3">
                                  <span className={cn(
                                    'text-[13px] font-bold',
                                    getStockStatus(p.stock, p.lowStockThreshold) === 'out' ? 'text-red-500'
                                    : getStockStatus(p.stock, p.lowStockThreshold) === 'low' ? 'text-amber-500'
                                    : 'text-navy'
                                  )}>
                                    {p.stock} units
                                  </span>
                                  <StatusPill status={getStockStatus(p.stock, p.lowStockThreshold)} />
                                </div>
                              </div>
                            )}

                            {/* Batch history for simple products */}
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
    </div>
  )
}
