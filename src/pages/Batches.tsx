import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useBatches } from '../hooks/useBatches'
import { useProducts } from '../hooks/useProducts'
import { formatNaira } from '../lib/utils'
import { Package, Search, Archive } from 'lucide-react'
import { cn } from '../lib/utils'

export const Batches: React.FC = () => {
  const { batches, isLoading } = useBatches()
  const { products } = useProducts()
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'depleted'>('all')

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

  const suppliers = useMemo(() => {
    const all = batches.map(b => b.supplier).filter(Boolean) as string[]
    return ['All', ...Array.from(new Set(all))]
  }, [batches])

  const filtered = useMemo(() => {
    return batches.filter(b => {
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
  }, [batches, supplierFilter, statusFilter, search, products])

  const totalCostValue = filtered.reduce((sum, b) => sum + b.quantityRemaining * b.costPrice, 0)
  const totalUnitsRemaining = filtered.reduce((sum, b) => sum + b.quantityRemaining, 0)
  const totalReceived = filtered.reduce((sum, b) => sum + b.quantityReceived, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch History"
        subtitle="Every stock delivery logged with cost, supplier and remaining units"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-xl p-5">
          <p className="text-[11px] font-bold text-gray uppercase tracking-wider">Total Batches</p>
          <p className="text-2xl font-bold text-navy mt-1">{filtered.length}</p>
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
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
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

      {/* Batch table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray/40 text-[13px]">Loading batches…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Archive size={36} className="text-gray/20 mx-auto mb-3" />
            <p className="text-[13px] text-gray/50 italic">No batches found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-border">
              <tr className="text-[11px] text-gray font-bold uppercase tracking-wider text-left">
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Supplier</th>
                <th className="px-5 py-4">Received</th>
                <th className="px-5 py-4 text-center">Qty In</th>
                <th className="px-5 py-4 text-center">Remaining</th>
                <th className="px-5 py-4 text-right">Cost / Unit</th>
                <th className="px-5 py-4 text-right">Sell Price</th>
                <th className="px-5 py-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(b => {
                const isDepleted = b.quantityRemaining === 0
                const pctSold = b.quantityReceived > 0
                  ? Math.round(((b.quantityReceived - b.quantityRemaining) / b.quantityReceived) * 100)
                  : 0

                return (
                  <tr key={b.id} className={cn('text-[13px] hover:bg-gray-50/60 transition-colors', isDepleted && 'opacity-50')}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getProductEmoji(b.productId)}</span>
                        <div>
                          <p className="font-bold text-navy leading-tight">{getProductName(b.productId, b.variantId)}</p>
                          {isDepleted && (
                            <span className="text-[10px] font-bold text-gray/40 uppercase tracking-wider">Depleted</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('text-[13px]', b.supplier ? 'text-navy font-medium' : 'text-gray/40 italic')}>
                        {b.supplier || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray">
                      {new Date(b.receivedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-navy">{b.quantityReceived}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn('font-bold', isDepleted ? 'text-gray/40' : 'text-navy')}>{b.quantityRemaining}</span>
                        <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', isDepleted ? 'bg-gray-300' : pctSold > 80 ? 'bg-amber-400' : 'bg-primary')}
                            style={{ width: `${100 - pctSold}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-orange-600">{formatNaira(b.costPrice)}</td>
                    <td className="px-5 py-4 text-right">
                      {b.sellPrice
                        ? <span className="font-bold text-primary">{formatNaira(b.sellPrice)}</span>
                        : <span className="text-gray/40 text-[12px]">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray/60 italic text-[12px]">{b.notes || '—'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
