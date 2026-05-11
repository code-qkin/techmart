import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useOrders } from '../hooks/useOrders'
import { useExpenses } from '../hooks/useExpenses'
import { formatNaira } from '../lib/utils'
import { cn } from '../lib/utils'
import { usePrivacyStore, maskAmount } from '../store/privacyStore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts'
import {
  TrendingUp, TrendingDown, Download,
  Eye, EyeOff, Calendar
} from 'lucide-react'

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom'

const PIE_COLORS = ['#E63946', '#3B82F6', '#F59E0B', '#10B981']

export const Reports: React.FC = () => {
  const { orders } = useOrders()
  const { expenses } = useExpenses()
  const { isHidden, toggle } = usePrivacyStore()
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const inDateRange = (dateStr: string) => {
    const now = new Date()
    const d = new Date(dateStr)
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

  const filteredOrders = useMemo(() =>
    orders.filter((o) => o.status !== 'Cancelled' && inDateRange(o.createdAt)),
    [orders, dateFilter, customFrom, customTo]
  )

  const salesOrders = useMemo(() =>
    filteredOrders.filter((o) => o.status === 'Completed' || o.status === 'Processing'),
    [filteredOrders]
  )

  const refundedOrders = useMemo(() =>
    filteredOrders.filter((o) => o.status === 'Refunded' || o.status === 'Returned'),
    [filteredOrders]
  )

  const filteredExpenses = useMemo(() =>
    expenses.filter((e) => inDateRange(e.date)),
    [expenses, dateFilter, customFrom, customTo]
  )

  const totalRevenue = useMemo(() => salesOrders.reduce((s, o) => s + o.totalAmount, 0), [salesOrders])
  const totalRefunds = useMemo(() => refundedOrders.reduce((s, o) => s + o.totalAmount, 0), [refundedOrders])
  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses])
  const totalOrders = salesOrders.length

  // Daily revenue chart (completed sales only)
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; orders: number }> = {}
    salesOrders.forEach((o) => {
      const day = o.createdAt.slice(0, 10)
      if (!map[day]) map[day] = { date: day, revenue: 0, orders: 0 }
      map[day].revenue += o.totalAmount
      map[day].orders += 1
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
      }))
  }, [salesOrders])

  // Top products (completed sales only)
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {}
    salesOrders.forEach((o) =>
      o.items.forEach((item) => {
        const key = item.productId
        if (!map[key]) map[key] = { name: item.productName.split(' (')[0], qty: 0, revenue: 0 }
        map[key].qty += item.quantity
        map[key].revenue += item.subtotal
      })
    )
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [salesOrders])

  // Payment method breakdown (completed sales only)
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    salesOrders.forEach((o) => {
      map[o.paymentMethod] = (map[o.paymentMethod] || 0) + o.totalAmount
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [salesOrders])

  // Staff performance (completed sales only)
  const staffPerf = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orders: number }> = {}
    salesOrders.forEach((o) => {
      if (!map[o.staffId]) map[o.staffId] = { name: o.staffName, revenue: 0, orders: 0 }
      map[o.staffId].revenue += o.totalAmount
      map[o.staffId].orders += 1
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [salesOrders])

  const exportCSV = () => {
    const rows = [
      ['Order ID', 'Customer', 'Staff', 'Amount', 'Payment', 'Status', 'Date'],
      ...filteredOrders.map((o) => [
        o.id, o.customerName, o.staffName,
        o.totalAmount, o.paymentMethod, o.status,
        new Date(o.createdAt).toLocaleDateString('en-NG')
      ])
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `techmart-report-${dateFilter}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <PageHeader title="Reports & Analytics" subtitle="Sales performance, profit overview and trends" />
          <button onClick={toggle} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[12px] font-bold text-gray hover:text-navy hover:border-gray-400 transition-colors shrink-0">
            {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
            {isHidden ? 'Show' : 'Hide'}
          </button>
        </div>
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
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-border bg-card px-4 py-2.5 rounded-lg text-[13px] font-bold hover:bg-gray-50 transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Gross Revenue', value: maskAmount(formatNaira(totalRevenue), isHidden), icon: TrendingUp, color: 'bg-primary/10 text-primary', sub: `${totalOrders} completed orders` },
          { label: 'Refunds & Returns', value: maskAmount(formatNaira(totalRefunds), isHidden), icon: TrendingDown, color: 'bg-purple-100 text-purple-600', sub: `${refundedOrders.length} order${refundedOrders.length !== 1 ? 's' : ''}` },
          { label: 'Total Expenses', value: maskAmount(formatNaira(totalExpenses), isHidden), icon: TrendingDown, color: 'bg-warning/10 text-warning', sub: `${filteredExpenses.length} entries` },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-md flex items-center justify-center shrink-0', s.color)}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="text-[11px] text-gray uppercase tracking-wide font-semibold">{s.label}</p>
                <p className="text-lg font-bold text-navy leading-tight">{s.value}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Timeline */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[15px] font-bold text-navy mb-6">Revenue Timeline</h3>
        {dailyData.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-gray text-[13px]">No data for selected range</div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₦${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  formatter={(v) => [formatNaira(Number(v)), 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" stroke="#E63946" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="text-[15px] font-bold text-navy mb-5">Top Selling Products</h3>
          {topProducts.length === 0 ? (
            <p className="text-gray text-[13px]">No data</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-[11px] font-bold text-gray w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-navy truncate">{p.name}</p>
                    <p className="text-[11px] text-gray">{p.qty} unit{p.qty !== 1 ? 's' : ''} sold</p>
                  </div>
                  <span className="text-[13px] font-bold text-primary shrink-0">{maskAmount(formatNaira(p.revenue), isHidden)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="bg-card border border-border rounded-lg p-5 flex flex-col">
          <h3 className="text-[15px] font-bold text-navy mb-5">Payment Methods</h3>
          {paymentBreakdown.length === 0 ? (
            <p className="text-gray text-[13px]">No data</p>
          ) : (
            <>
              <div className="h-[160px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {paymentBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatNaira(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {paymentBreakdown.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="font-medium text-navy">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray">{maskAmount(formatNaira(item.value), isHidden)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Staff Performance */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[15px] font-bold text-navy mb-5">Staff Performance</h3>
        {staffPerf.length === 0 ? (
          <p className="text-gray text-[13px]">No data for selected range</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffPerf.map((s, i) => (
              <div key={s.name} className="bg-background border border-border rounded-lg p-4 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0',
                  i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
                )}>
                  {s.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy text-[13px] truncate">{s.name}</p>
                  <p className="text-[11px] text-gray">{s.orders} order{s.orders !== 1 ? 's' : ''}</p>
                </div>
                <span className="font-bold text-primary text-[13px] shrink-0">{maskAmount(formatNaira(s.revenue), isHidden)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense Breakdown Bar */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-[15px] font-bold text-navy mb-5">Expenses by Category</h3>
        {filteredExpenses.length === 0 ? (
          <p className="text-gray text-[13px]">No expense data for selected range</p>
        ) : (() => {
          const byCategory = filteredExpenses.reduce<Record<string, number>>((acc, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount
            return acc
          }, {})
          const data = Object.entries(byCategory).map(([name, value]) => ({ name, value }))
          return (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₦${v / 1000}k`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} width={80} />
                  <Tooltip formatter={(v) => [formatNaira(Number(v)), 'Amount']} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '12px' }} />
                  <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
