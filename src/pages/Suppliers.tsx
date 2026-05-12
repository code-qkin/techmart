import React, { useState } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useSuppliers } from '../hooks/useSuppliers'
import { Plus, Trash2, Truck, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, removeSupplier } = useSuppliers()
  const [newName, setNewName] = useState('')
  const [search, setSearch] = useState('')
  const [deletingName, setDeletingName] = useState<string | null>(null)

  const filtered = suppliers.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  )

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
      toast.success(`"${name}" removed`)
    } catch {
      toast.error('Failed to remove supplier')
    }
  }

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
            {filtered.map((name) => (
              <li key={name} className="flex items-center justify-between px-6 py-4 group hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck size={15} className="text-primary" />
                  </div>
                  <span className="text-[14px] font-semibold text-navy">{name}</span>
                </div>

                {deletingName === name ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-150">
                    <span className="text-[12px] text-gray">Remove?</span>
                    <button
                      onClick={() => handleDelete(name)}
                      className="px-3 py-1.5 bg-red-500 text-white text-[12px] font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeletingName(null)}
                      className="px-3 py-1.5 border border-border text-[12px] font-bold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingName(name)}
                    className={cn(
                      'p-2 rounded-lg text-gray/30 hover:text-red-500 hover:bg-red-50 transition-all',
                      'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
