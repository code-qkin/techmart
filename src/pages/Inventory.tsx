import React, { useState } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { StatusBadge } from '../components/shared/StatusBadge'
import { useInventory } from '../hooks/useInventory'
import { getStockStatus, formatNaira } from '../lib/utils'
import { usePrivacyStore, maskAmount } from '../store/privacyStore'
import {
  Download,
  Minus,
  Plus,
  Search,
  AlertCircle,
  Package,
  XCircle,
  Smartphone,
  Laptop,
  Tablet,
  Headphones,
  Gamepad2,
  Watch,
  Speaker,
  MousePointer2,
  ChevronDown,
  ChevronRight,
  X,
  Banknote,
  Eye,
  EyeOff
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { useSuppliers } from '../hooks/useSuppliers'
import { useBatches } from '../hooks/useBatches'
import { cn } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import type { Product, ProductVariant, VariantUnit } from '../types'
import { toast } from 'sonner'

const getCategoryIcon = (category: string, name: string = '', size: number = 24) => {
  const props = { size, className: "shrink-0" }
  if (category === 'Phones') return <Smartphone {...props} />
  if (category === 'Laptops') return <Laptop {...props} />
  if (category === 'Tablets') return <Tablet {...props} />

  const lowName = name.toLowerCase()
  if (lowName.includes('watch')) return <Watch {...props} />
  if (lowName.includes('ear') || lowName.includes('airpod') || lowName.includes('headphone')) return <Headphones {...props} />
  if (lowName.includes('game') || lowName.includes('play')) return <Gamepad2 {...props} />
  if (lowName.includes('speak')) return <Speaker {...props} />
  if (lowName.includes('mouse')) return <MousePointer2 {...props} />

  return <Headphones {...props} />
}

export const Inventory: React.FC = () => {
  const navigate = useNavigate()
  const { inventory, isLoading, updateStock } = useInventory()
  const { updateProduct } = useProducts()
  const { isHidden, toggle } = usePrivacyStore()
  const { suppliers } = useSuppliers()
  const { receiveBatch } = useBatches()
  const [filter, setFilter] = useState('All Items')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<string[]>([])

  // Receive stock modal state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
  const [receivingProduct, setReceivingProduct] = useState<Product | null>(null)
  const [receivingVariant, setReceivingVariant] = useState<ProductVariant | null>(null)
  const [receiveQty, setReceiveQty] = useState('1')
  const [receiveCostPrice, setReceiveCostPrice] = useState('')
  const [receiveSellPrice, setReceiveSellPrice] = useState('')
  const [receiveSupplier, setReceiveSupplier] = useState('')
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [receiveUnits, setReceiveUnits] = useState<{ imei: string; supplier: string }[]>([])

  // Inline IMEI edit state
  const [imeiEditKey, setImeiEditKey] = useState<string | null>(null) // `${productId}:${variantId}`
  const [imeiEditUnits, setImeiEditUnits] = useState<VariantUnit[]>([])
  const [isSavingImei, setIsSavingImei] = useState(false)

  const openImeiEdit = (product: Product, variant: ProductVariant) => {
    const key = `${product.id}:${variant.id}`
    if (imeiEditKey === key) { setImeiEditKey(null); return }
    const existing = variant.units || []
    setImeiEditUnits(
      Array.from({ length: Math.max(variant.stock, existing.length) }, (_, i) => ({
        imei: existing[i]?.imei || '',
        supplier: existing[i]?.supplier || '',
      }))
    )
    setImeiEditKey(key)
  }

  const saveImeiEdit = async (product: Product, variant: ProductVariant) => {
    setIsSavingImei(true)
    try {
      const updatedVariants = (product.variants || []).map(v =>
        v.id === variant.id ? { ...v, units: imeiEditUnits } : v
      )
      await updateProduct({ ...product, variants: updatedVariants })
      toast.success('IMEI records saved')
      setImeiEditKey(null)
    } catch {
      toast.error('Failed to save IMEI records')
    } finally {
      setIsSavingImei(false)
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    )
  }

  const openReceiveModal = (product: Product, variant?: ProductVariant) => {
    setReceivingProduct(product)
    setReceivingVariant(variant || null)
    setReceiveQty('1')
    setReceiveCostPrice(variant?.costPrice ? String(variant.costPrice) : product.costPrice ? String(product.costPrice) : '')
    setReceiveSellPrice(variant?.price ? String(variant.price) : String(product.price))
    setReceiveSupplier('')
    setReceiveNotes('')
    setReceiveDate(new Date().toISOString().split('T')[0])
    setReceiveUnits(variant ? [{ imei: '', supplier: '' }] : [])
    setIsReceiveModalOpen(true)
  }

  const handleQtyChange = (value: string) => {
    setReceiveQty(value)
    if (receivingVariant) {
      const qty = Math.max(0, Number(value) || 0)
      setReceiveUnits(prev =>
        Array.from({ length: qty }, (_, i) => prev[i] || { imei: '', supplier: receiveSupplier })
      )
    }
  }

  const handleSupplierChange = (value: string) => {
    setReceiveSupplier(value)
    // Auto-fill any unit rows that haven't had their supplier manually set
    setReceiveUnits(prev => prev.map(u => u.supplier ? u : { ...u, supplier: value }))
  }

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receivingProduct || !receiveQty || !receiveCostPrice) return
    try {
      const filledUnits = receiveUnits
        .filter(u => u.imei.trim())
        .map(u => ({ ...u, supplier: u.supplier || receiveSupplier }))
      await receiveBatch({
        productId: receivingProduct.id,
        variantId: receivingVariant?.id,
        supplier: receiveSupplier || undefined,
        quantity: Number(receiveQty),
        costPrice: Number(receiveCostPrice),
        sellPrice: Number(receiveSellPrice) || undefined,
        notes: receiveNotes || undefined,
        receivedAt: new Date(receiveDate).toISOString(),
        units: filledUnits.length > 0 ? filledUnits : undefined,
      })
      toast.success(`${receiveQty} units received into stock`)
      setIsReceiveModalOpen(false)
    } catch {
      toast.error('Failed to receive stock')
    }
  }

  const stats = {
    total: inventory.length,
    low: inventory.filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
    out: inventory.filter(p => p.stock === 0).length,
    in: inventory.filter(p => p.stock > p.lowStockThreshold).length
  }

  const totalStockValue = inventory.reduce((sum, p) => {
    if (p.variants && p.variants.length > 0) {
      return sum + p.variants.reduce((vs, v) => vs + v.stock * (v.price ?? p.price), 0)
    }
    return sum + p.stock * p.price
  }, 0)

  const categoryValues = inventory.reduce<Record<string, number>>((acc, p) => {
    const val = p.variants && p.variants.length > 0
      ? p.variants.reduce((vs, v) => vs + v.stock * (v.price ?? p.price), 0)
      : p.stock * p.price
    acc[p.category] = (acc[p.category] || 0) + val
    return acc
  }, {})

  const filteredInventory = inventory.filter(p => {
    const status = getStockStatus(p.stock, p.lowStockThreshold)
    const matchesFilter = filter === 'All Items' ||
                         (filter === 'Low Stock' && status === 'low') ||
                         (filter === 'Out of Stock' && status === 'out')
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleAdjustStock = async (productId: string, currentStock: number, adjustment: number) => {
    const newStock = Math.max(0, currentStock + adjustment)
    try {
      await updateStock({ productId, newStock })
      toast.success("Stock updated")
    } catch {
      toast.error("Failed to update stock")
    }
  }

  const exportCSV = () => {
    const headers = ["Product", "Category", "Brand", "Current Stock", "Threshold", "Status"]
    const rows = inventory.map(p => [
      p.name, p.category, p.brand, p.stock, p.lowStockThreshold, getStockStatus(p.stock, p.lowStockThreshold)
    ])

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `techmart_inventory_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Inventory exported as CSV")
  }

  const columns: ColumnDef<Product>[] = [
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => {
        const hasVariants = row.original.variants && row.original.variants.length > 0
        if (!hasVariants) return null
        return (
          <button
            onClick={() => toggleRow(row.original.id)}
            className="p-1 hover:bg-gray-100 rounded text-gray"
          >
            {expandedRows.includes(row.original.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )
      }
    },
    {
      header: 'Product',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center text-primary shrink-0 border border-primary/10">
            {getCategoryIcon(row.original.category, row.original.name, 18)}
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-navy">{row.original.name}</span>
            <span className="text-[11px] text-gray uppercase tracking-wider">{row.original.brand}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Total Stock',
      accessorKey: 'stock',
      cell: ({ row }) => {
        const percentage = Math.min(100, (row.original.stock / 30) * 100)
        const status = getStockStatus(row.original.stock, row.original.lowStockThreshold)
        const barColor = status === 'out' ? 'bg-primary' : status === 'low' ? 'bg-warning' : 'bg-success'

        return (
          <div className="flex items-center gap-3 w-full max-w-[160px]">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={cn("h-full transition-all duration-500", barColor)} style={{ width: `${percentage}%` }} />
            </div>
            <span className="text-[12px] font-bold text-navy shrink-0">{row.original.stock}</span>
          </div>
        )
      }
    },
    {
      header: 'Variants',
      cell: ({ row }) => (
        <span className="text-[12px] font-bold text-gray uppercase bg-gray-100 px-2 py-0.5 rounded">
          {row.original.variants?.length || 0} Vars
        </span>
      )
    },
    {
      header: 'Last Restocked',
      cell: ({ row }) => {
        const d = row.original.stockUpdatedAt
        if (!d) return <span className="text-[12px] text-gray/40 italic">—</span>
        const date = new Date(d)
        return (
          <div>
            <p className="text-[13px] font-medium text-navy">{date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p className="text-[11px] text-gray/60">{date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        )
      }
    },
    {
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={getStockStatus(row.original.stock, row.original.lowStockThreshold)} />
    },
    {
      header: 'Action',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {!row.original.variants?.length && (
            <>
              <button
                onClick={() => handleAdjustStock(row.original.id, row.original.stock, -1)}
                disabled={row.original.stock === 0}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-white text-gray hover:text-navy hover:border-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => openReceiveModal(row.original)}
                className="h-8 px-2.5 flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white font-bold text-[11px] transition-colors"
              >
                <Plus size={12} /> Receive
              </button>
            </>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader
          title="Inventory"
          subtitle="Professional stock control & variant management"
        />
        <button onClick={toggle} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[12px] font-bold text-gray hover:text-navy hover:border-gray-400 transition-colors shrink-0">
          {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
          {isHidden ? 'Show' : 'Hide'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card p-4 rounded-lg border border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-success/10 text-success rounded-md flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-gray uppercase font-bold tracking-wider">In Stock</span>
            <span className="text-lg lg:text-2xl font-bold text-navy">{stats.in}</span>
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-warning/10 text-warning rounded-md flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-gray uppercase font-bold tracking-wider">Low Stock</span>
            <span className="text-lg lg:text-2xl font-bold text-navy">{stats.low}</span>
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-md flex items-center justify-center shrink-0">
            <XCircle size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-gray uppercase font-bold tracking-wider">Out of Stock</span>
            <span className="text-lg lg:text-2xl font-bold text-navy">{stats.out}</span>
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border flex items-center gap-3">
          <div className="w-10 h-10 bg-info/10 text-info rounded-md flex items-center justify-center shrink-0">
            <Banknote size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-gray uppercase font-bold tracking-wider">Stock Value</span>
            <span className="text-base lg:text-xl font-bold text-navy leading-tight truncate">{maskAmount(formatNaira(totalStockValue), isHidden)}</span>
          </div>
        </div>
      </div>

      {/* Category Valuation Breakdown */}
      {Object.keys(categoryValues).length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] font-bold text-gray uppercase tracking-wider mb-3">Stock Value by Category</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(categoryValues)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, val]) => {
                const pct = totalStockValue > 0 ? Math.round((val / totalStockValue) * 100) : 0
                return (
                  <div key={cat} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                    <div className="text-primary shrink-0">{getCategoryIcon(cat, '', 14)}</div>
                    <span className="text-[12px] font-bold text-navy">{cat}</span>
                    <span className="text-[12px] font-bold text-primary">{maskAmount(formatNaira(val), isHidden)}</span>
                    <span className="text-[11px] text-gray">{pct}%</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-lg border border-border">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
          {['All Items', 'Low Stock', 'Out of Stock'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all",
                filter === cat
                  ? "bg-primary text-white"
                  : "bg-transparent text-gray hover:bg-gray-100"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-64 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-border rounded-md text-[13px] focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-border px-4 py-2 rounded-md text-[13px] font-bold text-gray hover:text-navy hover:bg-gray-100 transition-colors shrink-0"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredInventory}
          isLoading={isLoading}
          emptyMessage="Inventory looks clear!"
          renderExpandedRow={(row) => (
            <div className="bg-gray-50/50 p-4 pl-14 border-y border-gray-100 animate-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-bold text-gray uppercase tracking-widest">Configured Variants</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {row.original.variants?.map((v, i) => {
                  const key = `${row.original.id}:${v.id}`
                  const isEditingImei = imeiEditKey === key
                  const filledUnits = (v.units || []).filter(u => u.imei)
                  const missingImei = v.stock - filledUnits.length

                  return (
                    <div key={i} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden group">
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-bold text-navy line-clamp-1">
                            {v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' • ')}
                          </span>
                          <span className="text-[10px] font-mono text-primary uppercase font-bold">{v.id}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="text-[13px] font-bold text-navy block">{v.stock} units</span>
                            {v.price && <span className="text-[10px] text-primary font-bold">{formatNaira(v.price)}</span>}
                          </div>
                          <button
                            onClick={() => openReceiveModal(row.original, v)}
                            className="px-2 py-1 text-primary hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100 transition-all bg-primary/5 rounded text-[10px] font-bold border border-primary/20"
                          >
                            + Receive
                          </button>
                          <button
                            onClick={() => navigate('/batches', { state: { productId: row.original.id, variantId: v.id } })}
                            className="px-2 py-1 text-gray hover:bg-gray-200 hover:text-navy opacity-0 group-hover:opacity-100 transition-all bg-gray-100 rounded text-[10px] font-bold border border-border"
                          >
                            Batches
                          </button>
                        </div>
                      </div>

                      {/* IMEI chips / edit panel */}
                      <div className="border-t border-gray-100">
                        {isEditingImei ? (
                          <div className="px-3 py-3 space-y-2">
                            <p className="text-[9px] font-bold text-gray uppercase tracking-widest">Edit IMEI & Supplier</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {imeiEditUnits.map((unit, ui) => (
                                <div key={ui} className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-gray/50 w-7 shrink-0 text-center">#{ui + 1}</span>
                                  <input
                                    value={unit.imei}
                                    onChange={e => setImeiEditUnits(prev => prev.map((u, j) => j === ui ? { ...u, imei: e.target.value } : u))}
                                    placeholder="IMEI / Serial"
                                    className="flex-1 h-8 px-2 border border-border rounded-lg text-[11px] font-mono focus:border-primary outline-none bg-gray-50 min-w-0"
                                  />
                                  <select
                                    value={unit.supplier || ''}
                                    onChange={e => setImeiEditUnits(prev => prev.map((u, j) => j === ui ? { ...u, supplier: e.target.value } : u))}
                                    className="h-8 px-1.5 border border-border rounded-lg text-[11px] focus:border-primary outline-none bg-gray-50 shrink-0 max-w-[110px]"
                                  >
                                    <option value="">Supplier</option>
                                    {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => setImeiEditKey(null)}
                                className="flex-1 h-8 border border-border rounded-lg text-[11px] font-bold text-gray hover:bg-gray-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveImeiEdit(row.original, v)}
                                disabled={isSavingImei}
                                className="flex-1 h-8 bg-primary text-white rounded-lg text-[11px] font-bold hover:bg-primary-dark disabled:opacity-60 transition-colors"
                              >
                                {isSavingImei ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openImeiEdit(row.original, v)}
                            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                              {filledUnits.length > 0
                                ? filledUnits.map((u, ui) => (
                                    <span key={ui} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-navy" title={u.supplier || ''}>{u.imei}</span>
                                  ))
                                : <span className="text-[11px] text-gray/40 italic">No IMEI recorded</span>
                              }
                            </div>
                            {missingImei > 0 && (
                              <span className="text-[10px] font-bold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0 ml-2">
                                {missingImei} missing
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          expandedRows={expandedRows}
        />
      </div>

      {/* Receive Stock Modal */}
      {isReceiveModalOpen && receivingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm" onClick={() => setIsReceiveModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="h-1 w-full bg-primary shrink-0" />
            <form onSubmit={handleReceiveStock} className="p-7 space-y-5 overflow-y-auto no-scrollbar">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-navy">Receive Stock</h3>
                  <p className="text-[12px] text-gray mt-0.5">
                    {receivingProduct.name}
                    {receivingVariant && <span className="font-bold text-primary"> — {receivingVariant.label || [receivingVariant.color, receivingVariant.storage, receivingVariant.ram, receivingVariant.condition].filter(Boolean).join(' • ')}</span>}
                  </p>
                </div>
                <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="p-1.5 text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={receiveQty}
                    onChange={e => handleQtyChange(e.target.value)}
                    className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Date Received</label>
                  <input type="date" required value={receiveDate} onChange={e => setReceiveDate(e.target.value)} className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[13px] focus:border-primary outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Cost Price (₦) *</label>
                  <input type="number" min={0} required value={receiveCostPrice} onChange={e => setReceiveCostPrice(e.target.value)} placeholder="What you paid per unit" className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-orange-600 focus:border-primary outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Sell Price (₦)</label>
                  <input type="number" min={0} value={receiveSellPrice} onChange={e => setReceiveSellPrice(e.target.value)} placeholder="Override sell price" className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-primary focus:border-primary outline-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Supplier</label>
                <select value={receiveSupplier} onChange={e => handleSupplierChange(e.target.value)} className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none">
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-navy uppercase tracking-wider">Notes</label>
                <input value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="e.g. Promo batch, slightly used…" className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
              </div>

              {/* IMEI rows — only for variant products */}
              {receivingVariant && receiveUnits.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-navy uppercase tracking-wider">IMEI / Serial Numbers <span className="text-gray/50 normal-case font-normal">(optional)</span></label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {receiveUnits.map((unit, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray/60 w-8 shrink-0 text-center">#{i + 1}</span>
                        <input
                          value={unit.imei}
                          onChange={e => setReceiveUnits(prev => prev.map((u, j) => j === i ? { ...u, imei: e.target.value } : u))}
                          placeholder="IMEI / Serial No."
                          className="flex-1 h-9 px-3 border border-border rounded-lg text-[12px] font-mono focus:border-primary outline-none bg-gray-50 min-w-0"
                        />
                        <select
                          value={unit.supplier}
                          onChange={e => setReceiveUnits(prev => prev.map((u, j) => j === i ? { ...u, supplier: e.target.value } : u))}
                          className="h-9 px-2 border border-border rounded-lg text-[12px] focus:border-primary outline-none bg-gray-50 shrink-0 max-w-[130px]"
                        >
                          <option value="">Supplier</option>
                          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receiveCostPrice && receiveSellPrice && Number(receiveCostPrice) > 0 && Number(receiveSellPrice) > 0 && (
                <p className="text-[12px] font-bold text-emerald-600 flex items-center gap-2">
                  <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                    {(((Number(receiveSellPrice) - Number(receiveCostPrice)) / Number(receiveSellPrice)) * 100).toFixed(1)}% margin
                  </span>
                  <span className="text-emerald-500 font-medium">{formatNaira(Number(receiveSellPrice) - Number(receiveCostPrice))} profit per unit</span>
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="flex-1 h-11 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">Receive {receiveQty} Units</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
