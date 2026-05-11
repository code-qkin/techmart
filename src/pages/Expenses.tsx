import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useExpenses } from '../hooks/useExpenses'
import { useOrders } from '../hooks/useOrders'
import { useAuthStore } from '../store/authStore'
import { useAuditStore } from '../store/auditStore'
import { formatNaira } from '../lib/utils'
import { cn } from '../lib/utils'
import { usePrivacyStore, maskAmount } from '../store/privacyStore'
import {
  Plus, X, Trash2, TrendingUp, TrendingDown, DollarSign,
  Receipt, Eye, EyeOff, Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import type { ExpenseCategory } from '../types'

const CATEGORIES: ExpenseCategory[] = ['Rent', 'Utilities', 'Salaries', 'Restocking', 'Marketing', 'Other']

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Rent: 'bg-blue-100 text-blue-700',
  Utilities: 'bg-amber-100 text-amber-700',
  Salaries: 'bg-purple-100 text-purple-700',
  Restocking: 'bg-green-100 text-green-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Other: 'bg-gray-100 text-gray-600',
}

export const Expenses: React.FC = () => {
  const { expenses, isLoading, addExpense, deleteExpense } = useExpenses()
  const { orders } = useOrders()
  const { user } = useAuthStore()
  const { addLog } = useAuditStore()
  const { isHidden, toggle } = usePrivacyStore()
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState<{ category: ExpenseCategory; description: string; amount: string; date: string }>({
    category: 'Rent',
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const inRange = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    if (dateFilter === 'today') return d.toDateString() === now.toDateString()
    if (dateFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
    if (dateFilter === 'month') { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m }
    if (dateFilter === 'custom') {
      if (customFrom && d < new Date(customFrom)) return false
      if (customTo) { const to = new Date(customTo); to.setHours(23, 59, 59, 999); if (d > to) return false }
      return true
    }
    return true
  }

  const filteredByDate = useMemo(() =>
    expenses.filter((e) => inRange(e.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, dateFilter, customFrom, customTo]
  )

  const filteredRevenue = useMemo(() =>
    orders.filter((o) => o.status !== 'Cancelled' && inRange(o.createdAt))
      .reduce((s, o) => s + o.totalAmount, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, dateFilter, customFrom, customTo]
  )

  const totalExpenses = useMemo(() => filteredByDate.reduce((s, e) => s + e.amount, 0), [filteredByDate])
  const netProfit = filteredRevenue - totalExpenses

  const filtered = useMemo(() =>
    filteredByDate
      .filter((e) => categoryFilter === 'All' || e.category === categoryFilter)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredByDate, categoryFilter]
  )

  const DATE_FILTER_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time', custom: 'Custom Range' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.description || !amount || amount <= 0) {
      toast.error('Please fill all fields correctly')
      return
    }
    try {
      const expense = await addExpense({
        category: form.category,
        description: form.description,
        amount,
        date: form.date,
        recordedBy: user?.name || 'Unknown',
      })
      addLog({
        userId: user?.id || '',
        userName: user?.name || '',
        userRole: user?.role || '',
        action: 'CREATE',
        entity: 'Expense',
        entityId: expense.id,
        details: `Expense logged: ${form.category} – ${formatNaira(amount)}`,
      })
      toast.success('Expense recorded')
      setIsModalOpen(false)
      setForm({ category: 'Rent', description: '', amount: '', date: new Date().toISOString().slice(0, 10) })
    } catch {
      toast.error('Failed to record expense')
    }
  }

  const handleDelete = async (id: string, desc: string) => {
    if (!confirm(`Delete expense: "${desc}"?`)) return
    try {
      await deleteExpense(id)
      toast.success('Expense deleted')
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <PageHeader title="Expenses" subtitle="Track store costs and view profit overview" />
          <button onClick={toggle} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[12px] font-bold text-gray hover:text-navy hover:border-gray-400 transition-colors shrink-0">
            {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
            {isHidden ? 'Show' : 'Hide'}
          </button>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} /> Log Expense
        </button>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          {([
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
            { key: 'custom', label: 'Custom' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5',
                dateFilter === key ? 'bg-navy text-white shadow' : 'text-gray hover:text-navy'
              )}
            >
              {key === 'custom' && <Calendar size={12} />}
              {label}
            </button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 px-3 bg-card border border-border rounded-lg text-[12px] font-medium text-navy focus:outline-none focus:border-primary"
            />
            <span className="text-[12px] text-gray font-bold">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              min={customFrom}
              className="h-9 px-3 bg-card border border-border rounded-lg text-[12px] font-medium text-navy focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* Period Summary */}
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-[11px] font-bold text-gray uppercase tracking-wide mb-4">
          {DATE_FILTER_LABELS[dateFilter]} Overview
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Gross Revenue', value: filteredRevenue, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Total Expenses', value: totalExpenses, icon: TrendingDown, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Net Profit', value: netProfit, icon: DollarSign, color: netProfit >= 0 ? 'text-success' : 'text-primary', bg: netProfit >= 0 ? 'bg-success/10' : 'bg-primary/10' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
              <div className={cn('w-11 h-11 rounded-md flex items-center justify-center shrink-0', s.bg, s.color)}>
                <s.icon size={22} />
              </div>
              <div>
                <p className="text-[11px] text-gray uppercase tracking-wide font-semibold">{s.label}</p>
                <p className={cn('text-xl font-bold', s.color)}>{maskAmount(formatNaira(s.value), isHidden)}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredRevenue > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[11px] text-gray font-medium mb-1">
              <span>Expenses vs Revenue</span>
              <span>{Math.min(100, Math.round((totalExpenses / filteredRevenue) * 100))}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-warning rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalExpenses / filteredRevenue) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {['All', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={cn(
              'px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all border',
              categoryFilter === cat ? 'bg-navy text-white border-navy' : 'bg-card text-gray border-border hover:border-gray-400'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expense List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center">
          <Receipt size={40} className="text-gray/20 mx-auto mb-3" />
          <p className="text-gray text-[14px]">No expenses recorded</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-border">
              <tr>
                {['Date', 'Category', 'Description', 'Recorded By', 'Amount', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-5 py-4 text-[13px] text-navy font-medium">
                    {new Date(e.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', CATEGORY_COLORS[e.category])}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[13px] text-navy">{e.description}</td>
                  <td className="px-5 py-4 text-[13px] text-gray">{e.recordedBy}</td>
                  <td className="px-5 py-4 text-[14px] font-bold text-navy">{maskAmount(formatNaira(e.amount), isHidden)}</td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => handleDelete(e.id, e.description)}
                      className="p-2 text-gray/40 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border bg-gray-50/50">
              <tr>
                <td colSpan={4} className="px-5 py-4 text-[12px] font-bold text-gray uppercase tracking-wide">
                  {categoryFilter === 'All' ? 'Total All Expenses' : `Total – ${categoryFilter}`}
                </td>
                <td className="px-5 py-4 text-[15px] font-bold text-navy">
                  {maskAmount(formatNaira(filtered.reduce((s, e) => s + e.amount, 0)), isHidden)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-navy text-[16px]">Log Expense</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray uppercase tracking-wide block">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, category: cat }))}
                      className={cn(
                        'py-2 px-3 rounded-lg text-[12px] font-bold border transition-all',
                        form.category === cat ? 'bg-navy text-white border-navy' : 'border-border text-gray hover:border-gray-400'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray uppercase tracking-wide block">Description *</label>
                <input
                  placeholder="Brief description of expense..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full h-10 bg-transparent border-b border-border text-[14px] focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray uppercase tracking-wide block">Amount (₦) *</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full h-10 bg-transparent border-b border-border text-[14px] focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray uppercase tracking-wide block">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full h-10 bg-transparent border-b border-border text-[14px] focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-11 border border-border rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
