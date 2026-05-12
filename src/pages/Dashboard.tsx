import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { StatCard } from '../components/shared/StatCard'
import { StatusBadge } from '../components/shared/StatusBadge'
import {
  TrendingUp, ShoppingBag, AlertTriangle, Package,
  ArrowRight, Eye, EyeOff
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { formatNaira, cn } from '../lib/utils'
import { Link } from 'react-router-dom'
import { usePrivacyStore, maskAmount } from '../store/privacyStore'
import { useOrders } from '../hooks/useOrders'
import { useProducts } from '../hooks/useProducts'
import { useInventory } from '../hooks/useInventory'

type DateFilter = 'today' | 'week' | 'month' | 'all'

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
}

const CATEGORY_COLORS: Record<string, string> = {
  Phones: '#E63946',
  Laptops: '#3B82F6',
  Tablets: '#F59E0B',
  Accessories: '#10B981',
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const activityColors = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-primary',
}

export const Dashboard: React.FC = () => {
  const { isHidden, toggle } = usePrivacyStore()
  const { orders } = useOrders()
  const { products } = useProducts()
  const { inventory } = useInventory()
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')

  const inRange = (dateStr: string) => {
    const now = new Date()
    const d = new Date(dateStr)
    if (dateFilter === 'today') return d.toDateString() === now.toDateString()
    if (dateFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
    if (dateFilter === 'month') { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m }
    return true
  }

  const salesOrders = useMemo(() =>
    orders.filter((o) => (o.status === 'Completed' || o.status === 'Processing') && inRange(o.createdAt)),
    [orders, dateFilter]
  )

  const filteredRevenue = useMemo(() => salesOrders.reduce((s, o) => s + o.totalAmount, 0), [salesOrders])
  const filteredOrderCount = salesOrders.length

  const lowStockCount = useMemo(() =>
    inventory.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
    [inventory]
  )

  // Bar chart — adapts to filter
  const chartData = useMemo(() => {
    const now = new Date()

    if (dateFilter === 'today') {
      return Array.from({ length: 24 }, (_, h) => {
        const revenue = orders
          .filter((o) => {
            if (o.status !== 'Completed' && o.status !== 'Processing') return false
            const t = new Date(o.createdAt)
            return t.toDateString() === now.toDateString() && t.getHours() === h
          })
          .reduce((s, o) => s + o.totalAmount, 0)
        return { label: h % 3 === 0 ? `${h}:00` : '', revenue }
      })
    }

    if (dateFilter === 'week') {
      const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (6 - i))
        d.setHours(0, 0, 0, 0)
        const next = new Date(d); next.setDate(d.getDate() + 1)
        const revenue = orders
          .filter((o) => {
            if (o.status !== 'Completed' && o.status !== 'Processing') return false
            const t = new Date(o.createdAt)
            return t >= d && t < next
          })
          .reduce((s, o) => s + o.totalAmount, 0)
        return { label: DAYS[d.getDay()], revenue }
      })
    }

    if (dateFilter === 'month') {
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (29 - i))
        d.setHours(0, 0, 0, 0)
        const next = new Date(d); next.setDate(d.getDate() + 1)
        const revenue = orders
          .filter((o) => {
            if (o.status !== 'Completed' && o.status !== 'Processing') return false
            const t = new Date(o.createdAt)
            return t >= d && t < next
          })
          .reduce((s, o) => s + o.totalAmount, 0)
        const day = d.getDate()
        return { label: day % 5 === 1 ? `${day} ${d.toLocaleDateString('en-NG', { month: 'short' })}` : '', revenue }
      })
    }

    // All time — by month (last 12)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const revenue = orders
        .filter((o) => {
          if (o.status !== 'Completed' && o.status !== 'Processing') return false
          const t = new Date(o.createdAt)
          return t >= d && t < next
        })
        .reduce((s, o) => s + o.totalAmount, 0)
      return { label: d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }), revenue }
    })
  }, [orders, dateFilter])

  // Category breakdown from products in catalog
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    products.forEach((p) => { cats[p.category] = (cats[p.category] || 0) + 1 })
    const total = products.length || 1
    return Object.entries(cats).map(([name, count]) => ({
      name,
      value: Math.round((count / total) * 100),
      color: CATEGORY_COLORS[name] || '#6B7280',
    }))
  }, [products])

  const recentOrders = useMemo(() =>
    (dateFilter === 'all' ? orders : orders.filter((o) => inRange(o.createdAt))).slice(0, 8),
    [orders, dateFilter]
  )

  const activities = useMemo(() =>
    orders.slice(0, 5).map((o) => ({
      type: o.status === 'Cancelled' ? 'error' : (o.status === 'Refunded' || o.status === 'Returned') ? 'warning' : 'success',
      text: `Order ${o.id} · ${o.customerName} · ${formatNaira(o.totalAmount)}`,
      time: timeAgo(o.createdAt),
    })),
    [orders]
  )

  const subtitle = new Date().toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const chartTitle: Record<DateFilter, string> = {
    today: 'Sales by Hour — Today',
    week: 'Sales by Day — Last 7 Days',
    month: 'Sales by Day — Last 30 Days',
    all: 'Sales by Month — All Time',
  }

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Overview" subtitle={subtitle} />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1">
            {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => setDateFilter(key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[12px] font-bold transition-all whitespace-nowrap',
                  dateFilter === key ? 'bg-primary text-white shadow' : 'text-gray hover:text-navy'
                )}
              >
                {DATE_FILTER_LABELS[key]}
              </button>
            ))}
          </div>
          <button onClick={toggle} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-[12px] font-bold text-gray hover:text-navy hover:border-gray-400 transition-colors">
            {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
            {isHidden ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label={`Revenue — ${DATE_FILTER_LABELS[dateFilter]}`}
          value={maskAmount(formatNaira(filteredRevenue), isHidden)}
          change={`${filteredOrderCount} sale${filteredOrderCount !== 1 ? 's' : ''}`}
          changeType="up"
          icon={TrendingUp}
          iconBg="red"
        />
        <StatCard
          label={`Orders — ${DATE_FILTER_LABELS[dateFilter]}`}
          value={String(filteredOrderCount)}
          change={filteredOrderCount > 0 ? 'Completed / Processing' : 'No orders yet'}
          changeType={filteredOrderCount > 0 ? 'up' : 'down'}
          icon={ShoppingBag}
          iconBg="green"
        />
        <StatCard
          label="Low Stock"
          value={String(lowStockCount)}
          change={lowStockCount > 0 ? 'Needs restocking' : 'All stocked up'}
          changeType={lowStockCount > 0 ? 'down' : 'up'}
          icon={AlertTriangle}
          iconBg="amber"
        />
        <StatCard
          label="Total Products"
          value={String(products.length)}
          change="In catalog"
          changeType="up"
          icon={Package}
          iconBg="blue"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Bar Chart */}
        <div className="lg:col-span-2 bg-card p-5 rounded-lg border border-border">
          <h3 className="text-[15px] font-bold text-navy mb-6">{chartTitle[dateFilter]}</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => v >= 1000 ? `₦${v / 1000}k` : `₦${v}`} />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  formatter={(value) => [formatNaira(Number(value)), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#E63946" radius={[4, 4, 0, 0]} barSize={dateFilter === 'month' ? 6 : 32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-card p-5 rounded-lg border border-border flex flex-col">
          <h3 className="text-[15px] font-bold text-navy mb-6">Catalog by Category</h3>
          {categoryData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray text-[13px]">No products yet</div>
          ) : (
            <>
              <div className="h-[200px] w-full relative flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-[11px] text-gray uppercase font-bold tracking-widest">Products</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-2 mt-4">
                {categoryData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] font-medium text-navy">{item.name}</span>
                    <span className="text-[11px] text-gray">{item.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-navy">Recent Orders</h3>
              <p className="text-[11px] text-gray mt-0.5">{DATE_FILTER_LABELS[dateFilter]} · {recentOrders.length} order{recentOrders.length !== 1 ? 's' : ''}</p>
            </div>
            <Link to="/orders" className="text-[12px] font-bold text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-10 text-center text-gray text-[13px]">No orders for {DATE_FILTER_LABELS[dateFilter].toLowerCase()}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-5 py-3 text-[11px] font-bold text-gray uppercase">Order ID</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-gray uppercase">Customer</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-gray uppercase hidden md:table-cell">Staff</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-gray uppercase">Amount</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-gray uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-border hover:bg-gray-50/30 transition-colors">
                      <td className="px-5 py-3.5 text-[13px] font-mono font-medium">{order.id}</td>
                      <td className="px-5 py-3.5 text-[13px]">{order.customerName}</td>
                      <td className="px-5 py-3.5 text-[13px] hidden md:table-cell">{order.staffName}</td>
                      <td className="px-5 py-3.5 text-[13px] font-bold">{maskAmount(formatNaira(order.totalAmount), isHidden)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-card rounded-lg border border-border flex flex-col">
          <div className="p-5 border-b border-border">
            <h3 className="text-[15px] font-bold text-navy">Recent Activity</h3>
            <p className="text-[11px] text-gray mt-0.5">Latest 5 transactions</p>
          </div>
          <div className="p-5 space-y-6">
            {activities.length === 0 ? (
              <p className="text-gray text-[13px]">No recent activity</p>
            ) : (
              activities.map((activity, i) => (
                <div key={i} className="flex gap-4">
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', activityColors[activity.type as keyof typeof activityColors])} />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[13px] text-navy font-medium leading-tight">{activity.text}</p>
                    <span className="text-[11px] text-gray">{activity.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
