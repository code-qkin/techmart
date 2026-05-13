import React, { useState } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { StatusBadge } from '../components/shared/StatusBadge'
import { useInventory } from '../hooks/useInventory'
import { getStockStatus, formatNaira } from '../lib/utils'
import { usePrivacyStore, maskAmount } from '../store/privacyStore'
import {
  Download,
  Search,
  AlertCircle,
  Package,
  XCircle,
  ChevronDown,
  ChevronRight,
  Banknote,
  Eye,
  EyeOff
} from 'lucide-react'
import { getProductIcon } from '../lib/productIcon'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { cn } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import type { Product, ProductVariant, VariantUnit } from '../types'
import { toast } from 'sonner'


export const Inventory: React.FC = () => {
  const navigate = useNavigate()
  const { inventory, isLoading } = useInventory()
  const { updateProduct } = useProducts()
  const { isHidden, toggle } = usePrivacyStore()
  const [filter, setFilter] = useState('All Items')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<string[]>([])

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
            {getProductIcon(row.original.category, row.original.name, 18)}
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
                    <div className="text-primary shrink-0">{getProductIcon(cat, '', 14)}</div>
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
                            <p className="text-[9px] font-bold text-gray uppercase tracking-widest">Edit IMEI</p>
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
    </div>
  )
}
