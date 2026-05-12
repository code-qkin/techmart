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
  Edit,
  X,
  Shield,
  Banknote,
  Eye,
  EyeOff
} from 'lucide-react'
import { useProducts } from '../hooks/useProducts'
import { useSuppliers } from '../hooks/useSuppliers'
import { cn } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import type { Product, ProductVariant, VariantUnit } from '../types'
import { toast } from 'sonner'

// Icon mapping helper
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
  const { inventory, isLoading, updateStock } = useInventory()
  const { updateProduct } = useProducts()
  const { isHidden, toggle } = usePrivacyStore()
  const { suppliers, addSupplier } = useSuppliers()
  const [newSupplierInput, setNewSupplierInput] = useState('')
  const [filter, setFilter] = useState('All Items')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<string[]>([])
  
  // State for editing from inventory
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingVariants, setEditingVariants] = useState<ProductVariant[]>([])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    )
  }

  const openEditSheet = (product: Product) => {
    setEditingProduct(product)
    setEditingVariants(product.variants || [])
    setIsEditSheetOpen(true)
  }

  const handleVariantStockChange = (variantIndex: number, newStock: number) => {
    const stock = Math.max(0, newStock)
    setEditingVariants(prev => {
      const updated = [...prev]
      const currentUnits = updated[variantIndex].units || []
      let units: VariantUnit[]
      if (stock > currentUnits.length) {
        units = [...currentUnits, ...Array.from({ length: stock - currentUnits.length }, () => ({ imei: '', supplier: '' }))]
      } else {
        units = currentUnits.slice(0, stock)
      }
      updated[variantIndex] = { ...updated[variantIndex], stock, units }
      return updated
    })
  }

  const updateVariantField = (variantIndex: number, field: 'price' | 'costPrice', value: number) => {
    setEditingVariants(prev => {
      const updated = [...prev]
      updated[variantIndex] = { ...updated[variantIndex], [field]: value || undefined }
      return updated
    })
  }

  const updateUnit = (variantIndex: number, unitIndex: number, field: keyof VariantUnit, value: string) => {
    setEditingVariants(prev => {
      const updated = [...prev]
      const units = [...(updated[variantIndex].units || [])]
      units[unitIndex] = { ...units[unitIndex], [field]: value }
      updated[variantIndex] = { ...updated[variantIndex], units }
      return updated
    })
  }

  const handleUpdateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingProduct) return

    const formData = new FormData(e.currentTarget)
    
    // Calculate total stock from variants
    const totalStock = editingVariants.reduce((sum, v) => sum + v.stock, 0)

    const productData: Product = {
      ...editingProduct,
      name: formData.get('name') as string,
      brand: formData.get('brand') as string,
      price: Number(formData.get('price')),
      costPrice: Number(formData.get('costPrice')) || undefined,
      stock: editingVariants.length > 0 ? totalStock : Number(formData.get('stock')),
      lowStockThreshold: Number(formData.get('threshold')),
      description: formData.get('description') as string,
      variants: editingVariants,
    }

    try {
      await updateProduct(productData)
      toast.success("Product updated")
      setIsEditSheetOpen(false)
    } catch {
      toast.error("Failed to update product")
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
                onClick={() => handleAdjustStock(row.original.id, row.original.stock, 1)}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-white text-gray hover:text-navy hover:border-navy transition-colors"
              >
                <Plus size={14} />
              </button>
            </>
          )}
          <button 
            onClick={() => openEditSheet(row.original)}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-border bg-white text-gray hover:text-primary hover:border-primary transition-colors ml-2"
          >
            <Edit size={14} />
          </button>
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
                {row.original.variants?.map((v, i) => (
                  <div key={i} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden group">
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-bold text-navy line-clamp-1">
                          {v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' • ')}
                        </span>
                        <span className="text-[10px] font-mono text-primary uppercase font-bold">{v.id}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-[13px] font-bold text-navy block">{v.stock} units</span>
                          {v.price && <span className="text-[10px] text-primary font-bold">{formatNaira(v.price)}</span>}
                        </div>
                        <button onClick={() => openEditSheet(row.original)} className="p-1.5 text-gray hover:text-navy opacity-0 group-hover:opacity-100 transition-all bg-gray-50 rounded">
                          <Edit size={12} />
                        </button>
                      </div>
                    </div>
                    {/* Units (IMEI) chips in the expanded row */}
                    {v.units && v.units.filter(u => u.imei).length > 0 && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                        <p className="text-[9px] font-bold text-gray uppercase tracking-widest mb-1.5">Units in stock</p>
                        <div className="flex flex-wrap gap-1">
                          {v.units.filter(u => u.imei).map((u, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-navy" title={u.supplier || ''}>{u.imei}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          expandedRows={expandedRows}
        />
      </div>

      {/* Edit Product Sheet Overlay */}
      {isEditSheetOpen && editingProduct && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={() => setIsEditSheetOpen(false)} />
          <div className="relative w-full max-w-[560px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-navy">Quick Inventory Update</h2>
                <p className="text-[12px] text-gray mt-0.5">Manage stock levels for {editingProduct.name}</p>
              </div>
              <button onClick={() => setIsEditSheetOpen(false)} className="p-2 text-gray hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
              <div className="space-y-6">
                <h3 className="text-[11px] font-bold text-navy uppercase tracking-[0.15em] flex items-center gap-2">
                  <Shield size={16} /> Product Information
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-navy">Selling Price (Base)</label>
                    <input name="price" type="number" required defaultValue={editingProduct.price} className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-navy">Stock Threshold</label>
                    <input name="threshold" type="number" required defaultValue={editingProduct.lowStockThreshold} className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
                  </div>
                  {editingVariants.length === 0 && (
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[12px] font-bold text-navy">Cost Price (What you paid)</label>
                      <input name="costPrice" type="number" min={0} defaultValue={editingProduct.costPrice || ''} placeholder="0" className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[11px] font-bold text-navy uppercase tracking-[0.15em] flex items-center justify-between">
                  Stock per Variant
                  <span className="text-primary font-black">{editingVariants.reduce((s, v) => s + v.stock, 0)} Total</span>
                </h3>
                
                {editingVariants.length === 0 ? (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-navy">Current Stock</label>
                    <input name="stock" type="number" required defaultValue={editingProduct.stock} className="w-full h-11 px-3 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editingVariants.map((v, i) => (
                      <div key={i} className="bg-gray-50 border border-border rounded-2xl overflow-hidden">
                        {/* Variant header + stock counter */}
                        <div className="flex items-center justify-between p-4">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-bold text-navy">
                              {v.label || [v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' • ')}
                            </span>
                            <span className="text-[11px] font-mono text-gray">{v.id}</span>
                          </div>
                          <div className="flex items-center bg-white border border-border rounded-xl p-1 shadow-sm shrink-0">
                            <button type="button" onClick={() => handleVariantStockChange(i, v.stock - 1)} className="w-8 h-8 flex items-center justify-center text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-all">-</button>
                            <input
                              type="number"
                              value={v.stock}
                              onChange={(e) => handleVariantStockChange(i, Number(e.target.value))}
                              className="w-14 text-center text-[14px] font-black text-navy bg-transparent outline-none"
                            />
                            <button type="button" onClick={() => handleVariantStockChange(i, v.stock + 1)} className="w-8 h-8 flex items-center justify-center text-gray hover:text-navy hover:bg-gray-100 rounded-lg transition-all">+</button>
                          </div>
                        </div>

                        {/* Selling price + cost price per variant */}
                        <div className="border-t border-border px-4 py-3 grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray uppercase tracking-widest">Selling Price (₦)</label>
                            <input
                              type="number"
                              min={0}
                              value={v.price ?? ''}
                              onChange={e => updateVariantField(i, 'price', Number(e.target.value))}
                              placeholder="0"
                              className="w-full h-9 px-3 border border-border rounded-lg text-[13px] focus:border-primary outline-none bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray uppercase tracking-widest">Cost Price (₦)</label>
                            <input
                              type="number"
                              min={0}
                              value={v.costPrice ?? ''}
                              onChange={e => updateVariantField(i, 'costPrice', Number(e.target.value))}
                              placeholder="0"
                              className="w-full h-9 px-3 border border-border rounded-lg text-[13px] focus:border-primary outline-none bg-white"
                            />
                          </div>
                        </div>

                        {/* Unit rows — one per stock count */}
                        {v.stock > 0 && (
                          <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                            <p className="text-[10px] font-bold text-gray uppercase tracking-widest mb-2">Unit IMEI & Supplier</p>
                            {(v.units || Array.from({ length: v.stock }, () => ({ imei: '', supplier: '' }))).slice(0, v.stock).map((unit, ui) => (
                              <div key={ui} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray w-12 shrink-0">Unit {ui + 1}</span>
                                <input
                                  value={unit.imei}
                                  onChange={e => updateUnit(i, ui, 'imei', e.target.value)}
                                  placeholder="IMEI / Serial"
                                  className="flex-1 h-9 px-3 border border-border rounded-lg text-[12px] font-mono focus:border-primary outline-none bg-white min-w-0"
                                />
                                <select
                                  value={unit.supplier || ''}
                                  onChange={e => updateUnit(i, ui, 'supplier', e.target.value)}
                                  className="h-9 px-2 border border-border rounded-lg text-[12px] focus:border-primary outline-none bg-white shrink-0 max-w-[130px]"
                                >
                                  <option value="">Supplier</option>
                                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add new supplier inline */}
                    <div className="flex gap-2 pt-1">
                      <input
                        value={newSupplierInput}
                        onChange={e => setNewSupplierInput(e.target.value)}
                        placeholder="Add new supplier to list..."
                        className="flex-1 h-9 px-3 border border-border rounded-lg text-[13px] focus:border-primary outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={async () => { if (newSupplierInput.trim()) { try { await addSupplier(newSupplierInput.trim()); setNewSupplierInput('') } catch {} } }}
                        className="px-4 h-9 border border-border rounded-lg text-[12px] font-bold text-gray hover:text-navy hover:border-gray-400 transition-colors shrink-0"
                      >
                        + Add Supplier
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <input type="hidden" name="name" value={editingProduct.name} />
              <input type="hidden" name="brand" value={editingProduct.brand} />
              <input type="hidden" name="description" value={editingProduct.description || ''} />

              <div className="pt-6 border-t border-border flex gap-4 pb-8">
                <button type="button" onClick={() => setIsEditSheetOpen(false)} className="flex-1 h-14 border border-border bg-white rounded-2xl font-bold text-[15px] hover:bg-gray-50 transition-all">Cancel</button>
                <button type="submit" className="flex-1 h-14 bg-primary text-white rounded-2xl font-bold text-[15px] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20">Commit Inventory</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
