import React, { useState, useRef, useEffect } from 'react'
import { Search, Plus } from 'lucide-react'
import { getProductIcon } from '../../lib/productIcon'
import type { Product } from '../../types'
import { cn } from '../../lib/utils'

interface ProductMatch {
  id: string
  name: string
  brand: string
  category: Product['category']
}

interface Props {
  products: Product[]
  value: string
  onChange: (value: string) => void
  onSelect: (match: ProductMatch | null) => void
  placeholder?: string
  className?: string
}

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t === q) return 3
  if (t.startsWith(q)) return 2
  if (t.includes(q)) return 1
  return 0
}

export const ProductSearch: React.FC<Props> = ({
  products,
  value,
  onChange,
  onSelect,
  placeholder = 'Search or type new product name…',
  className,
}) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const matches: ProductMatch[] = value.trim().length < 1
    ? []
    : products
        .map(p => ({
          product: p,
          score: Math.max(
            fuzzyScore(value, p.name),
            fuzzyScore(value, p.brand),
            fuzzyScore(value, `${p.brand} ${p.name}`),
          ),
        }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(x => ({
          id: x.product.id,
          name: x.product.name,
          brand: x.product.brand,
          category: x.product.category,
        }))

  const showCreate = value.trim().length > 1 && !matches.some(m => m.name.toLowerCase() === value.trim().toLowerCase())

  const handleSelect = (match: ProductMatch) => {
    onChange(match.name)
    onSelect(match)
    setOpen(false)
  }

  const handleCreateNew = () => {
    onSelect(null) // null signals "new product, fill brand/category manually"
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray/40 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); onSelect(null); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-10 pl-8 pr-4 bg-white border border-border rounded-xl text-[13px] focus:border-primary outline-none transition-colors"
          autoComplete="off"
        />
      </div>

      {open && (matches.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-100">
          {matches.map(m => (
            <button
              key={m.id}
              type="button"
              onMouseDown={() => handleSelect(m)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-7 h-7 bg-primary/5 border border-primary/10 rounded-md flex items-center justify-center text-primary shrink-0">
                {getProductIcon(m.category, m.name, 13)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-navy truncate">{m.name}</p>
                <p className="text-[11px] text-gray/50">{m.brand} · {m.category}</p>
              </div>
            </button>
          ))}

          {showCreate && (
            <button
              type="button"
              onMouseDown={handleCreateNew}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-emerald-50 transition-colors text-left border-t border-border"
            >
              <div className="w-7 h-7 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-center shrink-0">
                <Plus size={13} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-emerald-700">Create "{value.trim()}"</p>
                <p className="text-[11px] text-gray/50">New product — fill brand & category below</p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
