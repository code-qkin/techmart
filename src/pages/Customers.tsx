import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useCustomers } from '../hooks/useCustomers'
import { formatNaira, getErrorMessage, cn } from '../lib/utils'
import {
  Users, Plus, Search, X, Phone, Mail, ShoppingBag,
  TrendingUp, Star, Edit, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import type { Customer } from '../types'

const getInitials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

const TIER_COLORS = [
  { label: 'VIP', min: 2000000, class: 'bg-amber-100 text-amber-700 border-amber-200' },
  { label: 'Regular', min: 500000, class: 'bg-info/10 text-info border-info/20' },
  { label: 'New', min: 0, class: 'bg-gray-100 text-gray border-gray-200' },
]

const getTier = (spent: number) =>
  TIER_COLORS.find((t) => spent >= t.min) || TIER_COLORS[2]

export const Customers: React.FC = () => {
  const { customers, isLoading, addCustomer, updateCustomer } = useCustomers()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'totalSpent' | 'totalOrders' | 'name'>('totalSpent')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Form state
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })

  const filtered = useMemo(() => {
    return customers
      .filter((c) =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      )
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        return b[sortBy] - a[sortBy]
      })
  }, [customers, search, sortBy])

  const totalRevenue = useMemo(() => customers.reduce((s, c) => s + c.totalSpent, 0), [customers])
  const vipCount = useMemo(() => customers.filter((c) => c.totalSpent >= 2000000).length, [customers])

  const openAdd = () => {
    setEditingCustomer(null)
    setForm({ name: '', phone: '', email: '', notes: '' })
    setIsModalOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditingCustomer(c)
    setForm({ name: c.name, phone: c.phone, email: c.email || '', notes: c.notes || '' })
    setSelectedCustomer(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return }
    try {
      if (editingCustomer) {
        await updateCustomer({ ...editingCustomer, ...form })
        toast.success('Customer updated')
      } else {
        await addCustomer({ name: form.name, phone: form.phone, email: form.email || undefined, notes: form.notes || undefined })
        toast.success('Customer added')
      }
      setIsModalOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err, editingCustomer ? 'Failed to update customer.' : 'Failed to add customer.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Customers" subtitle="Manage your customer relationships and purchase history" />
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: customers.length, icon: Users, color: 'bg-info/10 text-info' },
          { label: 'Total Lifetime Revenue', value: formatNaira(totalRevenue), icon: TrendingUp, color: 'bg-primary/10 text-primary' },
          { label: 'VIP Customers', value: vipCount, icon: Star, color: 'bg-amber-100 text-amber-600' },
          { label: 'Avg. Spend', value: formatNaira(customers.length ? Math.round(totalRevenue / customers.length) : 0), icon: ShoppingBag, color: 'bg-success/10 text-success' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-md flex items-center justify-center shrink-0', s.color)}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-[11px] text-gray uppercase tracking-wide font-semibold">{s.label}</p>
              <p className="text-lg font-bold text-navy leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5">
          <Search size={16} className="text-gray shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="flex-1 bg-transparent border-none focus:outline-none text-[13px]"
          />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-gray" /></button>}
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5 text-[13px] font-medium text-gray">
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-transparent border-none focus:outline-none font-bold text-navy cursor-pointer"
          >
            <option value="totalSpent">Total Spent</option>
            <option value="totalOrders">Total Orders</option>
            <option value="name">Name</option>
          </select>
          <ChevronDown size={14} />
        </div>
      </div>

      {/* Customer Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 animate-pulse h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center">
          <Users size={40} className="text-gray/20 mx-auto mb-3" />
          <p className="text-gray text-[14px]">No customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const tier = getTier(c.totalSpent)
            return (
              <div
                key={c.id}
                className="bg-card border border-border rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedCustomer(c)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-[15px] shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div>
                      <p className="font-bold text-navy text-[15px] leading-tight">{c.name}</p>
                      <p className="text-[12px] text-gray">{c.phone}</p>
                    </div>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', tier.class)}>
                    {tier.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  <div>
                    <p className="text-[10px] text-gray uppercase tracking-wide font-semibold">Total Spent</p>
                    <p className="font-bold text-primary text-[14px]">{formatNaira(c.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray uppercase tracking-wide font-semibold">Orders</p>
                    <p className="font-bold text-navy text-[14px]">{c.totalOrders}</p>
                  </div>
                </div>
                {c.lastOrderDate && (
                  <p className="text-[11px] text-gray mt-3">
                    Last order: {new Date(c.lastOrderDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Customer Detail Side Panel */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)} />
          <div className="relative w-full max-w-[420px] h-full bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-navy">Customer Profile</h2>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 text-gray hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-2xl">
                  {getInitials(selectedCustomer.name)}
                </div>
                <div>
                  <p className="font-bold text-navy text-[18px]">{selectedCustomer.name}</p>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', getTier(selectedCustomer.totalSpent).class)}>
                    {getTier(selectedCustomer.totalSpent).label}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-[14px]">
                  <Phone size={16} className="text-gray shrink-0" />
                  <span className="text-navy">{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex items-center gap-3 text-[14px]">
                    <Mail size={16} className="text-gray shrink-0" />
                    <span className="text-navy">{selectedCustomer.email}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Spent', value: formatNaira(selectedCustomer.totalSpent) },
                  { label: 'Total Orders', value: selectedCustomer.totalOrders },
                  { label: 'Avg. Order', value: selectedCustomer.totalOrders ? formatNaira(Math.round(selectedCustomer.totalSpent / selectedCustomer.totalOrders)) : '—' },
                  { label: 'Member Since', value: new Date(selectedCustomer.createdAt).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' }) },
                ].map((stat) => (
                  <div key={stat.label} className="bg-background rounded-lg p-4 border border-border">
                    <p className="text-[10px] text-gray uppercase tracking-wide font-semibold mb-1">{stat.label}</p>
                    <p className="font-bold text-navy text-[14px]">{stat.value}</p>
                  </div>
                ))}
              </div>

              {selectedCustomer.notes && (
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
                  <p className="text-[10px] text-gray uppercase tracking-wide font-semibold mb-1">Notes</p>
                  <p className="text-[13px] text-navy italic">"{selectedCustomer.notes}"</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border">
              <button
                onClick={() => openEdit(selectedCustomer)}
                className="w-full h-11 flex items-center justify-center gap-2 border border-border rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors"
              >
                <Edit size={16} /> Edit Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-navy text-[16px]">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'e.g. John Doe', type: 'text' },
                { label: 'Phone Number *', key: 'phone', placeholder: 'e.g. 08012345678', type: 'tel' },
                { label: 'Email Address', key: 'email', placeholder: 'optional', type: 'email' },
              ].map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[11px] font-bold text-gray uppercase tracking-wide block">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full h-10 bg-transparent border-b border-border text-[14px] focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray uppercase tracking-wide block">Notes</label>
                <textarea
                  placeholder="Any internal notes about this customer..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="w-full bg-transparent border-b border-border text-[14px] focus:outline-none focus:border-primary transition-all resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-11 border border-border rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                  {editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
