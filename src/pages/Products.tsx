import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { FAB } from '../components/shared/FAB'
import { useProducts } from '../hooks/useProducts'
import { formatNaira, getErrorMessage } from '../lib/utils'
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  Table as TableIcon,
  X,
  Edit,
  Trash2,
  Smartphone,
  Laptop,
  Tablet,
  Headphones,
  Gamepad2,
  Watch,
  Speaker,
  MousePointer2
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import type { Product, ProductVariant } from '../types'
import { toast } from 'sonner'

// Icon mapping helper
const getCategoryIcon = (category: string, name: string = '', size: number = 24) => {
  const props = { size, className: "shrink-0" }
  if (category === 'Phones') return <Smartphone {...props} />
  if (category === 'Laptops') return <Laptop {...props} />
  if (category === 'Tablets') return <Tablet {...props} />
  
  const lowName = (name || '').toLowerCase()
  if (lowName.includes('watch')) return <Watch {...props} />
  if (lowName.includes('ear') || lowName.includes('airpod') || lowName.includes('headphone')) return <Headphones {...props} />
  if (lowName.includes('game') || lowName.includes('play')) return <Gamepad2 {...props} />
  if (lowName.includes('speak')) return <Speaker {...props} />
  if (lowName.includes('mouse')) return <MousePointer2 {...props} />
  
  return <Headphones {...props} />
}

export const Products: React.FC = () => {
  const { products, isLoading, addProduct, updateProduct, deleteProduct } = useProducts()
  const [filter, setFilter] = useState('All')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'variants'>('general')
  const [searchQuery, setSearchQuery] = useState('')
  
  // General tab form state — persists across tab switches
  const [formName, setFormName] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formCategory, setFormCategory] = useState<Product['category']>('Phones')
  const [formPrice, setFormPrice] = useState('')
  const [formDescription, setFormDescription] = useState('')

  // Multi-dimensional Variant State
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedStorages, setSelectedStorages] = useState<string[]>([])
  const [selectedRAMs, setSelectedRAMs] = useState<string[]>([])
  const [selectedConditions, setSelectedConditions] = useState<ProductVariant['condition'][]>(['New'])

  const categories = ['All', 'Phones', 'Laptops', 'Tablets', 'Accessories']
  const colorOptions = ['Black', 'White', 'Silver', 'Gold', 'Graphite', 'Blue', 'Green', 'Red', 'Grey', 'Midnight', 'Starlight', 'Natural Titanium']
  const storageOptions = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']
  const ramOptions = ['4GB', '6GB', '8GB', '12GB', '16GB', '32GB', '64GB']
  const conditionOptions: ProductVariant['condition'][] = ['New', 'Open Box', 'Pre-owned']

  const openEditSheet = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormBrand(product.brand)
    setFormCategory(product.category)
    setFormPrice(String(product.price))
    setFormDescription(product.description || '')
    setProductVariants(product.variants || [])
    
    const colors = Array.from(new Set(product.variants?.map(v => v.color).filter(Boolean))) as string[]
    const storages = Array.from(new Set(product.variants?.map(v => v.storage).filter(Boolean))) as string[]
    const rams = Array.from(new Set(product.variants?.map(v => v.ram).filter(Boolean))) as string[]
    const conditions = Array.from(new Set(product.variants?.map(v => v.condition))) as ProductVariant['condition'][]
    
    setSelectedColors(colors)
    setSelectedStorages(storages)
    setSelectedRAMs(rams)
    setSelectedConditions(conditions.length > 0 ? conditions : ['New'])
    
    setActiveTab('general')
    setIsAddSheetOpen(true)
  }

  const closePortal = () => {
    setIsAddSheetOpen(false)
    setEditingProduct(null)
    setFormName('')
    setFormBrand('')
    setFormCategory('Phones')
    setFormPrice('')
    setFormDescription('')
    setProductVariants([])
    setSelectedColors([])
    setSelectedStorages([])
    setSelectedRAMs([])
    setSelectedConditions(['New'])
    setActiveTab('general')
  }

  const generateVariants = () => {
    const newVariants: ProductVariant[] = []
    
    selectedConditions.forEach(condition => {
      if (selectedColors.length === 0 && selectedStorages.length === 0 && selectedRAMs.length === 0) {
        newVariants.push({
          id: `SKU-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          condition,
          stock: 0
        })
        return
      }

      const colors = selectedColors.length > 0 ? selectedColors : [undefined]
      const storages = selectedStorages.length > 0 ? selectedStorages : [undefined]
      const rams = selectedRAMs.length > 0 ? selectedRAMs : [undefined]

      colors.forEach(color => {
        storages.forEach(storage => {
          rams.forEach(ram => {
            newVariants.push({
              id: `SKU-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
              color,
              storage,
              ram,
              condition,
              stock: 0
            })
          })
        })
      })
    })

    setProductVariants(newVariants)
  }

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
    const updated = [...productVariants]
    updated[index] = { ...updated[index], [field]: value } as ProductVariant
    setProductVariants(updated)
  }

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const currentStock = editingProduct?.stock || 0
    const currentThreshold = editingProduct?.lowStockThreshold || 5

    const productData: Omit<Product, 'id'> = {
      name: formName,
      category: formCategory,
      brand: formBrand,
      price: Number(formPrice),
      stock: currentStock,
      lowStockThreshold: currentThreshold,
      emoji: formCategory === 'Phones' ? '📱' :
             formCategory === 'Laptops' ? '💻' :
             formCategory === 'Tablets' ? '📟' : '🎧',
      description: formDescription,
      variants: productVariants.map(v => ({
        ...v,
        // Preserve stock from existing variants if ID matches
        stock: editingProduct?.variants?.find(ev => ev.id === v.id)?.stock || 0
      })),
      createdAt: editingProduct?.createdAt || new Date().toISOString(),
    }

    try {
      if (editingProduct) {
        await updateProduct({ ...editingProduct, ...productData })
        toast.success("Catalog item updated")
      } else {
        await addProduct(productData as unknown as Product)
        toast.success("New item added to catalog")
      }
      closePortal()
    } catch (err) {
      toast.error(getErrorMessage(err, editingProduct ? 'Failed to update product.' : 'Failed to add product.'))
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchQuery || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filter === 'All' || p.category === filter
      return matchesSearch && matchesCategory
    })
  }, [products, searchQuery, filter])

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Remove this item from catalog?")) return
    try {
      await deleteProduct(id)
      toast.success("Product removed")
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove product.'))
    }
  }

  const columns: ColumnDef<Product>[] = [
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
      header: 'Category',
      accessorKey: 'category',
      cell: ({ getValue }) => <span className="text-gray text-[13px]">{getValue() as string}</span>
    },
    {
      header: 'Base Price',
      accessorKey: 'price',
      cell: ({ getValue }) => <span className="font-bold text-navy">{formatNaira(getValue() as number)}</span>
    },
    {
      header: 'Configurations',
      cell: ({ row }) => (
        <span className="text-[12px] font-bold text-gray uppercase bg-gray-100 px-2 py-0.5 rounded">
          {row.original.variants?.length || 0} Variants
        </span>
      )
    },
    {
      header: 'Action',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => openEditSheet(row.original)}
            className="p-2 text-gray hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
          >
            <Edit size={16} />
          </button>
          <button 
            onClick={() => handleDeleteProduct(row.original.id)}
            className="p-2 text-gray hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader 
          title="Product Catalog" 
          subtitle="Define items, technical specifications and variants" 
        />
        <button 
          onClick={() => setIsAddSheetOpen(true)}
          className="hidden md:flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-md font-bold text-[14px] hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Plus size={18} /> Establish New Item
        </button>
      </div>

      {/* Top Bar / Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-lg border border-border">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all",
                filter === cat 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "bg-transparent text-gray hover:bg-gray-100"
              )}
            >
              {cat === 'Phones' ? '📱 Phones' : 
               cat === 'Laptops' ? '💻 Laptops' :
               cat === 'Tablets' ? '📟 Tablets' :
               cat === 'Accessories' ? '🎧 Accessories' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-64 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
            <input 
              type="text" 
              placeholder="Search catalog by name or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-border rounded-md text-[13px] focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center border border-border rounded-md overflow-hidden shrink-0">
            <button 
              onClick={() => setView('table')}
              className={cn("p-2", view === 'table' ? "bg-gray-100 text-navy" : "text-gray hover:bg-gray-50")}
            >
              <TableIcon size={18} />
            </button>
            <button 
              onClick={() => setView('grid')}
              className={cn("p-2", view === 'grid' ? "bg-gray-100 text-navy" : "text-gray hover:bg-gray-50")}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {view === 'table' ? (
        <DataTable 
          columns={columns} 
          data={filteredProducts} 
          isLoading={isLoading} 
          emptyMessage="Your catalog is currently empty"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredProducts.map((product) => (
            <div 
              key={product.id} 
              onClick={() => openEditSheet(product)}
              className="bg-white p-6 rounded-2xl border border-border flex flex-col items-center text-center group hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm border border-primary/10">
                {getCategoryIcon(product.category, product.name, 44)}
              </div>
              <h4 className="text-[15px] font-bold text-navy line-clamp-1">{product.name}</h4>
              <span className="text-[11px] text-gray mb-1 uppercase tracking-wider font-bold">{product.brand}</span>
              <p className="text-primary font-black text-[18px] mb-4">{formatNaira(product.price)}</p>
              <div className="flex flex-col items-center gap-1.5">
                {product.variants && (
                  <span className="text-[10px] font-bold text-navy uppercase bg-gray-100 px-2 py-0.5 rounded tracking-tighter">
                    {product.variants.length} Configurations
                  </span>
                )}
              </div>
              
              <button className="absolute top-4 right-4 p-1.5 text-gray hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity bg-gray-50 rounded-lg">
                <Edit size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <FAB onClick={() => setIsAddSheetOpen(true)} />

      {/* Add/Edit Product Professional Sheet */}
      {isAddSheetOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={closePortal} />
          <div className="relative w-full max-w-[640px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-navy">{editingProduct ? 'Configure Catalog Item' : 'New Catalog Entry'}</h2>
                <div className="flex gap-4 mt-2">
                  {['general', 'variants'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as typeof activeTab)}
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-widest pb-1 transition-all border-b-2",
                        activeTab === tab ? "text-primary border-primary" : "text-gray border-transparent hover:text-navy"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={closePortal} className="p-2 text-gray hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                
                {/* Tab 1: General Info */}
                {activeTab === 'general' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-navy uppercase tracking-wider">Product Name</label>
                        <input required value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none transition-all" placeholder="e.g. MacBook Pro M3" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-navy uppercase tracking-wider">Brand</label>
                        <input required value={formBrand} onChange={(e) => setFormBrand(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none transition-all" placeholder="e.g. Apple" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-navy uppercase tracking-wider">Category</label>
                        <select required value={formCategory} onChange={(e) => setFormCategory(e.target.value as Product['category'])} className="w-full h-12 px-4 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none transition-all appearance-none">
                          <option value="Phones">Phones</option>
                          <option value="Laptops">Laptops</option>
                          <option value="Tablets">Tablets</option>
                          <option value="Accessories">Accessories</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] font-bold text-navy uppercase tracking-wider">Base Selling Price (₦)</label>
                        <input type="number" required value={formPrice} onChange={(e) => setFormPrice(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-border rounded-xl text-[14px] font-bold text-primary focus:border-primary outline-none transition-all" placeholder="0.00" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-navy uppercase tracking-wider">Description</label>
                      <textarea rows={4} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full p-4 bg-gray-50 border border-border rounded-xl text-[14px] focus:border-primary outline-none transition-all resize-none" placeholder="Detailed product specifications and features..."></textarea>
                    </div>
                  </div>
                )}

                {/* Tab 2: Pricing & Variants */}
                {activeTab === 'variants' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 space-y-6">
                      <h3 className="text-[13px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <LayoutGrid size={16} /> Define Variant Dimensions
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray uppercase tracking-widest">Colors</label>
                          <div className="flex flex-wrap gap-2">
                            {colorOptions.map(c => (
                              <button key={c} type="button" onClick={() => setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={cn("px-3 py-1 rounded-lg text-[11px] font-bold border transition-all", selectedColors.includes(c) ? "bg-primary border-primary text-white" : "bg-white border-border text-gray hover:border-gray-400")}>{c}</button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray uppercase tracking-widest">Storage (ROM)</label>
                          <div className="flex flex-wrap gap-2">
                            {storageOptions.map(s => (
                              <button key={s} type="button" onClick={() => setSelectedStorages(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("px-3 py-1 rounded-lg text-[11px] font-bold border transition-all", selectedStorages.includes(s) ? "bg-primary border-primary text-white" : "bg-white border-border text-gray hover:border-gray-400")}>{s}</button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray uppercase tracking-widest">Memory (RAM)</label>
                          <div className="flex flex-wrap gap-2">
                            {ramOptions.map(r => (
                              <button key={r} type="button" onClick={() => setSelectedRAMs(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])} className={cn("px-3 py-1 rounded-lg text-[11px] font-bold border transition-all", selectedRAMs.includes(r) ? "bg-primary border-primary text-white" : "bg-white border-border text-gray hover:border-gray-400")}>{r}</button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray uppercase tracking-widest">Condition</label>
                          <div className="flex flex-wrap gap-2">
                            {conditionOptions.map(c => (
                              <button key={c} type="button" onClick={() => setSelectedConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={cn("px-3 py-1 rounded-lg text-[11px] font-bold border transition-all", selectedConditions.includes(c) ? "bg-primary border-primary text-white" : "bg-white border-border text-gray hover:border-gray-400")}>{c}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button type="button" onClick={generateVariants} className="w-full py-3 bg-navy text-white rounded-xl font-bold text-[13px] hover:bg-navy-dark transition-all">
                        Generate Combinations
                      </button>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[12px] font-bold text-navy uppercase tracking-widest">Configured Configurations ({productVariants.length})</h3>
                      <div className="space-y-2">
                        {productVariants.map((v, i) => (
                          <div key={i} className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl shadow-sm hover:border-primary/30 transition-all group">
                            <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                              <div className="col-span-1">
                                <span className="text-[10px] font-bold text-gray uppercase block mb-0.5">Variant</span>
                                <span className="text-[12px] font-bold text-navy line-clamp-1">
                                  {[v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' ')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-gray uppercase block mb-0.5">SKU / ID</span>
                                <input value={v.id} onChange={(e) => updateVariant(i, 'id', e.target.value)} className="w-full text-[12px] font-mono text-primary bg-transparent focus:underline outline-none" />
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-gray uppercase block mb-0.5">Price Override</span>
                                <input type="number" value={v.price || ''} onChange={(e) => updateVariant(i, 'price', Number(e.target.value))} placeholder="Optional" className="w-full text-[13px] font-bold text-primary bg-transparent outline-none border-b border-transparent focus:border-primary" />
                              </div>
                            </div>
                            <button type="button" onClick={() => setProductVariants(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-gray/40 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              <div className="p-6 border-t border-border bg-gray-50/50 flex gap-4">
                <button 
                  type="button" 
                  onClick={closePortal}
                  className="flex-1 h-14 border border-border bg-white rounded-2xl font-bold text-[15px] hover:bg-gray-100 transition-all shadow-sm"
                >
                  Discard Changes
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-14 bg-primary text-white rounded-2xl font-bold text-[15px] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20"
                >
                  {editingProduct ? 'Commit Changes' : 'Establish Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
