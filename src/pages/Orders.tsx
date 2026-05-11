import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { StatusBadge } from '../components/shared/StatusBadge'
import { useOrders } from '../hooks/useOrders'
import { useProducts } from '../hooks/useProducts'
import { useCustomers } from '../hooks/useCustomers'
import { useAuthStore } from '../store/authStore'
import { useAuditStore } from '../store/auditStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { useSettingsStore } from '../store/settingsStore'
import { formatNaira } from '../lib/utils'
import {
  Plus, Search, X, Trash2, CheckCircle2, Printer,
  ArrowLeft, ArrowRight, Eye, Edit, Receipt,
  Smartphone, Laptop, Tablet, Headphones, Gamepad2,
  Watch, Speaker, MousePointer2, RotateCcw, Calendar
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import type { Order, Product, ProductVariant, CartItem, Customer } from '../types'
import { toast } from 'sonner'

const getCategoryIcon = (category: string, name: string = '', size: number = 24) => {
  const props = { size, className: 'shrink-0' }
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

export const Orders: React.FC = () => {
  const { orders, isLoading, addOrder, updateOrder, returnOrder } = useOrders()
  const { products } = useProducts()
  const { customers, updateCustomer } = useCustomers()
  const { user } = useAuthStore()
  const { addLog } = useAuditStore()
  const { addNotification } = useNotificationsStore()
  const { storeName, address, phone: storePhone, email: storeEmail } = useSettingsStore()

  const [filter, setFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isEditingFullOrder, setIsEditingFullOrder] = useState(false)
  const [printableOrder, setPrintableOrder] = useState<Order | null>(null)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)

  // New Order State
  const [step, setStep] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [newOrderCategory, setNewOrderCategory] = useState('All')
  const [selectingVariantFor, setSelectingVariantFor] = useState<Product | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<Order['paymentMethod']>('Cash')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [transactionRef, setTransactionRef] = useState('')
  const [notes, setNotes] = useState('')

  // Layaway
  const [depositAmount, setDepositAmount] = useState(0)
  const [layawayDueDate, setLayawayDueDate] = useState('')

  const filteredOrders = useMemo(() => {
    const now = new Date()
    return orders.filter((o) => {
      if (filter !== 'All' && o.status !== filter) return false
      const d = new Date(o.createdAt)
      if (dateFilter === 'today') return d.toDateString() === now.toDateString()
      if (dateFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
      if (dateFilter === 'month') { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m }
      if (dateFilter === 'custom') {
        if (customFrom && d < new Date(customFrom)) return false
        if (customTo) { const to = new Date(customTo); to.setHours(23, 59, 59, 999); if (d > to) return false }
        return true
      }
      return true
    })
  }, [orders, filter, dateFilter, customFrom, customTo])

  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + ((item.variant?.price || item.product.price) * item.quantity), 0),
    [cart]
  )

  const totalAmount = useMemo(() =>
    Math.max(0, subtotal - discountAmount),
    [subtotal, discountAmount]
  )

  const customerSuggestions = useMemo(() => {
    if (!customerName || customerName.length < 1) return []
    return customers.filter((c) =>
      c.name.toLowerCase().includes(customerName.toLowerCase()) ||
      c.phone.includes(customerName)
    ).slice(0, 5)
  }, [customers, customerName])

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name)
    setCustomerPhone(c.phone)
    setSelectedCustomer(c)
    setShowCustomerDrop(false)
  }

  const searchResults = useMemo(() =>
    products.filter((p) => {
      const matchesSearch = !productSearch ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.brand.toLowerCase().includes(productSearch.toLowerCase())
      const matchesCategory = newOrderCategory === 'All' || p.category === newOrderCategory
      return matchesSearch && matchesCategory
    }).slice(0, 8),
    [productSearch, newOrderCategory, products]
  )

  const addToCart = (product: Product, variant?: ProductVariant) => {
    if (product.variants && product.variants.length > 0) {
      if (!variant) { setSelectingVariantFor(product); return }
      if (variant.stock <= 0) { toast.error('This variant is out of stock'); return }
      const existing = cart.find((i) => i.product.id === product.id && i.variant?.id === variant.id)
      if (existing && existing.quantity >= variant.stock) { toast.error(`Only ${variant.stock} units available`); return }
    } else if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock`); return
    }
    const existing = cart.find((i) => i.product.id === product.id && i.variant?.id === variant?.id)
    if (existing) {
      setCart(cart.map((i) => (i.product.id === product.id && i.variant?.id === variant?.id) ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setCart([...cart, { product, quantity: 1, variant }])
    }
    setProductSearch('')
    setSelectingVariantFor(null)
  }

  const updateCartQty = (productId: string, variantId: string | undefined, delta: number) => {
    setCart(cart.map((item) => {
      if (item.product.id === productId && item.variant?.id === variantId) {
        const newQty = Math.max(1, item.quantity + delta)
        const stockLimit = item.variant ? item.variant.stock : item.product.stock
        if (delta > 0 && newQty > stockLimit) { toast.error('Cannot exceed available stock'); return item }
        return { ...item, quantity: newQty }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string, variantId?: string) =>
    setCart(cart.filter((i) => !(i.product.id === productId && i.variant?.id === variantId)))

  const handleStartEditFullOrder = () => {
    if (!selectedOrder) return
    const newCart = selectedOrder.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      const variant = product?.variants?.find((v) => v.id === item.variantId)
      return {
        product: product || { id: item.productId, name: item.productName, price: item.unitPrice, category: 'Accessories', brand: 'Unknown', stock: 999, lowStockThreshold: 0, emoji: '📦', createdAt: new Date().toISOString() } as Product,
        quantity: item.quantity,
        variant,
      }
    })
    setCart(newCart)
    setCustomerName(selectedOrder.customerName)
    setCustomerPhone(selectedOrder.customerPhone)
    setPaymentMethod(selectedOrder.paymentMethod)
    setDiscountAmount(selectedOrder.discountAmount)
    setTransactionRef(selectedOrder.transactionReference || '')
    setNotes(selectedOrder.notes || '')
    setIsEditingFullOrder(true)
    setIsDetailModalOpen(false)
    setIsNewOrderModalOpen(true)
    setStep(1)
  }

  const handleConfirmOrder = async () => {
    if (!customerName || !customerPhone) { toast.error('Please fill in customer details'); return }
    if (paymentMethod === 'Layaway') {
      if (!depositAmount || depositAmount <= 0) { toast.error('Enter a deposit amount for layaway'); return }
      if (!layawayDueDate) { toast.error('Enter a due date for layaway'); return }
      if (depositAmount >= totalAmount) { toast.error('Deposit must be less than total – use Cash/POS for full payment'); return }
    }

    const orderData = {
      staffId: user?.id || '1',
      staffName: user?.name || 'Unknown',
      customerName,
      customerPhone,
      items: cart.map((item) => ({
        productId: item.product.id,
        productName: item.product.name + (item.variant ? ` (${[item.variant.color, item.variant.storage, item.variant.condition].filter(Boolean).join(' ')})` : ''),
        quantity: item.quantity,
        unitPrice: item.variant?.price || item.product.price,
        subtotal: (item.variant?.price || item.product.price) * item.quantity,
        color: item.variant?.color,
        storage: item.variant?.storage,
        condition: item.variant?.condition,
        variantId: item.variant?.id,
      })),
      subtotal,
      taxAmount: 0,
      discountAmount,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === 'Layaway' ? ('Partial' as const) : ('Paid' as const),
      transactionReference: transactionRef,
      status: isEditingFullOrder ? (selectedOrder?.status || 'Completed') : (paymentMethod === 'Layaway' ? 'Pending' : 'Completed') as Order['status'],
      installment: paymentMethod === 'Layaway' ? {
        depositAmount,
        remainingAmount: totalAmount - depositAmount,
        dueDate: layawayDueDate,
        isPaid: false,
      } : undefined,
      notes,
    }

    try {
      if (isEditingFullOrder && selectedOrder) {
        await updateOrder({ ...selectedOrder, ...orderData })
        addLog({ userId: user?.id || '', userName: user?.name || '', userRole: user?.role || '', action: 'UPDATE', entity: 'Order', entityId: selectedOrder.id, details: `Order ${selectedOrder.id} updated` })
        toast.success('Order updated successfully!')
        resetNewOrder()
      } else {
        const newOrder = await addOrder(orderData)
        addLog({ userId: user?.id || '', userName: user?.name || '', userRole: user?.role || '', action: 'CREATE', entity: 'Order', entityId: newOrder.id, details: `New order for ${customerName} – ${formatNaira(totalAmount)}` })
        addNotification({ type: 'new_order', title: 'New Order', message: `${newOrder.id} placed by ${customerName} – ${formatNaira(totalAmount)}`, link: '/orders' })
        // Update existing customer stats if one was selected
        if (selectedCustomer) {
          updateCustomer({
            ...selectedCustomer,
            totalOrders: selectedCustomer.totalOrders + 1,
            totalSpent: selectedCustomer.totalSpent + totalAmount,
            lastOrderDate: new Date().toISOString(),
          }).catch(() => {})
        }
        setStep(3)
        toast.success('Order confirmed!')
      }
    } catch {
      toast.error(isEditingFullOrder ? 'Failed to update order' : 'Failed to create order')
    }
  }

  const handleRefund = async () => {
    if (!selectedOrder) return
    try {
      await updateOrder({ ...selectedOrder, status: 'Refunded', paymentStatus: 'Unpaid' })
      addLog({ userId: user?.id || '', userName: user?.name || '', userRole: user?.role || '', action: 'REFUND', entity: 'Order', entityId: selectedOrder.id, details: `Order ${selectedOrder.id} refunded – ${formatNaira(selectedOrder.totalAmount)}` })
      addNotification({ type: 'refund', title: 'Refund Processed', message: `Order ${selectedOrder.id} has been refunded`, link: '/orders' })
      toast.success('Refund processed successfully')
      setIsRefundModalOpen(false)
      setIsDetailModalOpen(false)
    } catch {
      toast.error('Failed to process refund')
    }
  }

  const handleReturn = async () => {
    if (!selectedOrder) return
    try {
      await returnOrder(selectedOrder)
      addLog({ userId: user?.id || '', userName: user?.name || '', userRole: user?.role || '', action: 'REFUND', entity: 'Order', entityId: selectedOrder.id, details: `Order ${selectedOrder.id} returned – stock restored for ${selectedOrder.items.length} item(s)` })
      addNotification({ type: 'refund', title: 'Device Returned', message: `Order ${selectedOrder.id} returned – stock has been restored`, link: '/orders' })
      toast.success('Device returned and stock restored')
      setIsRefundModalOpen(false)
      setIsDetailModalOpen(false)
    } catch {
      toast.error('Failed to process return')
    }
  }

  const resetNewOrder = () => {
    setIsNewOrderModalOpen(false)
    setIsEditingFullOrder(false)
    setStep(1)
    setCart([])
    setProductSearch('')
    setNewOrderCategory('All')
    setSelectingVariantFor(null)
    setCustomerName('')
    setCustomerPhone('')
    setShowCustomerDrop(false)
    setSelectedCustomer(null)
    setPaymentMethod('Cash')
    setDiscountAmount(0)
    setTransactionRef('')
    setNotes('')
    setDepositAmount(0)
    setLayawayDueDate('')
  }

  const handlePrint = (order: Order) => {
    setPrintableOrder(order)
    setTimeout(() => { window.print(); setPrintableOrder(null) }, 100)
  }

  const columns: ColumnDef<Order>[] = [
    {
      header: 'Order ID',
      accessorKey: 'id',
      cell: ({ getValue }) => <span className="font-mono font-bold text-navy text-[13px]">#{getValue() as string}</span>
    },
    {
      header: 'Customer',
      accessorKey: 'customerName',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-bold text-navy">{row.original.customerName}</span>
          <span className="text-[11px] text-gray">{row.original.customerPhone}</span>
        </div>
      )
    },
    {
      header: 'Items',
      accessorKey: 'items',
      cell: ({ getValue }) => <span className="text-gray text-[13px]">{(getValue() as Order['items']).length} items</span>
    },
    {
      header: 'Total Amount',
      accessorKey: 'totalAmount',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-bold text-primary">{formatNaira(row.original.totalAmount)}</span>
          {row.original.paymentMethod === 'Layaway' && row.original.installment && (
            <span className="text-[10px] text-amber-600 font-bold">Layaway · Dep: {formatNaira(row.original.installment.depositAmount)}</span>
          )}
        </div>
      )
    },
    {
      header: 'Payment',
      accessorKey: 'paymentMethod',
      cell: ({ getValue }) => <span className="text-[12px] font-medium text-gray">{getValue() as string}</span>
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />
    },
    {
      header: 'Action',
      cell: ({ row }) => (
        <button
          onClick={() => { setSelectedOrder(row.original); setIsDetailModalOpen(true) }}
          className="p-2 text-gray hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
        >
          <Eye size={18} />
        </button>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Orders" subtitle="Monitor and manage all sales transactions" />
        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-[14px] hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={18} /> New Order
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* Status filter */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', 'Completed', 'Processing', 'Returned', 'Refunded'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all border',
                filter === f ? 'bg-navy text-white border-navy shadow-md' : 'bg-white text-gray border-border hover:border-gray-400'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-1">
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
                  dateFilter === key ? 'bg-primary text-white shadow' : 'text-gray hover:text-navy'
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
                className="h-9 px-3 bg-white border border-border rounded-lg text-[12px] font-medium text-navy focus:outline-none focus:border-primary"
              />
              <span className="text-[12px] text-gray font-bold">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom}
                className="h-9 px-3 bg-white border border-border rounded-lg text-[12px] font-medium text-navy focus:outline-none focus:border-primary"
              />
            </div>
          )}

          <span className="text-[12px] text-gray font-medium ml-auto">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <DataTable columns={columns} data={filteredOrders} isLoading={isLoading} emptyMessage="No transactions found" />

      {/* ── New Order Modal ── */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={resetNewOrder} />
          <div className={cn(
            'relative bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200',
            step === 2 ? 'w-full max-w-[1100px] h-[92vh]' : 'w-full max-w-[720px] h-[90vh]'
          )}>
            {/* Variant Overlay */}
            {selectingVariantFor && (
              <div className="absolute inset-0 z-[110] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-navy/30 backdrop-blur-[4px]" onClick={() => setSelectingVariantFor(null)} />
                <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[440px] animate-in zoom-in-95 duration-200 border border-border flex flex-col max-h-[80vh]">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-[16px] font-bold text-navy">Select Variant</h3>
                      <p className="text-[11px] text-gray font-medium">Available options for {selectingVariantFor.name}</p>
                    </div>
                    <button onClick={() => setSelectingVariantFor(null)} className="p-1.5 text-gray hover:bg-gray-100 rounded-full"><X size={18} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-2">
                    {selectingVariantFor.variants?.map((v) => {
                      const isOut = v.stock <= 0
                      return (
                        <button key={v.id} disabled={isOut} onClick={() => addToCart(selectingVariantFor, v)}
                          className={cn('w-full py-3.5 px-4 rounded-xl border transition-all flex items-center justify-between text-left', isOut ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-primary hover:bg-primary/5')}
                        >
                          <div>
                            <span className="text-[13px] font-bold text-navy block">{[v.color, v.storage, v.ram, v.condition].filter(Boolean).join(' • ')}</span>
                            <span className={cn('text-[10px] font-bold uppercase', v.stock < 5 ? 'text-amber-500' : 'text-green-600')}>
                              {v.stock} in stock {v.price ? `• ${formatNaira(v.price)}` : ''}
                            </span>
                          </div>
                          {!isOut && <ArrowRight size={16} className="text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  {isEditingFullOrder ? <Edit size={18} /> : <Receipt size={18} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-navy">{isEditingFullOrder ? 'Edit Order' : 'New Sale'}</h2>
                  <p className="text-[11px] text-gray uppercase font-bold tracking-widest">{step === 1 ? 'Select Products' : step === 2 ? 'Checkout Details' : 'Confirmed'}</p>
                </div>
              </div>
              <button onClick={resetNewOrder} className="p-2 text-gray hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Step 1 */}
              {step === 1 && (
                <div className="flex-1 p-8 overflow-y-auto space-y-10 no-scrollbar bg-white">
                  <div className="space-y-6">
                    <div className="flex items-center gap-6 border-b border-border pb-1 overflow-x-auto no-scrollbar">
                      {['All', 'Phones', 'Laptops', 'Tablets', 'Accessories'].map((cat) => (
                        <button key={cat} onClick={() => setNewOrderCategory(cat)} className={cn('pb-3 text-[13px] font-bold transition-all relative', newOrderCategory === cat ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary' : 'text-gray hover:text-navy')}>{cat}</button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-gray/40" />
                      <input type="text" autoFocus placeholder="Search items by name or brand..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full h-12 pl-8 pr-4 bg-transparent border-b border-border text-[15px] focus:outline-none focus:border-primary transition-all placeholder:text-gray/30" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[11px] font-bold text-gray uppercase tracking-[0.15em]">Available Catalog</h3>
                    <div className="max-h-[320px] overflow-y-auto pr-2 no-scrollbar">
                      <div className="grid grid-cols-1 gap-1">
                        {searchResults.map((p) => {
                          const isOut = p.stock <= 0
                          return (
                            <button key={p.id} disabled={isOut} onClick={() => addToCart(p)} className={cn('w-full py-4 flex items-center justify-between group transition-all border-b border-gray-50 last:border-0', isOut ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50/50 px-2 -mx-2 rounded-lg')}>
                              <div className="flex items-center gap-4 text-left">
                                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray/60 group-hover:bg-primary/10 group-hover:text-primary transition-colors">{getCategoryIcon(p.category, p.name, 20)}</div>
                                <div>
                                  <span className="text-[14px] font-bold text-navy block leading-tight">{p.name}</span>
                                  <span className="text-[11px] text-gray">{p.brand} • {p.variants?.length || 0} configurations</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <div className="text-[14px] font-bold text-navy">{formatNaira(p.price)}</div>
                                  <div className={cn('text-[10px] font-bold uppercase', p.stock < 5 ? 'text-amber-600' : 'text-green-600')}>{isOut ? 'Out of stock' : `${p.stock} units left`}</div>
                                </div>
                                <Plus size={16} className="text-gray group-hover:text-primary transition-colors" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold text-navy uppercase tracking-[0.15em]">Cart ({cart.length})</h3>
                      {cart.length > 0 && <button onClick={() => setCart([])} className="text-[11px] text-gray hover:text-red-500 font-bold uppercase tracking-wider">Clear</button>}
                    </div>
                    <div className="max-h-[240px] overflow-y-auto pr-2 no-scrollbar space-y-4">
                      {cart.length === 0 ? (
                        <div className="py-8 text-center text-gray/30 text-[13px] italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">No items in cart</div>
                      ) : (
                        cart.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2">
                            <div className="flex flex-col">
                              <span className="text-[14px] font-bold text-navy leading-tight">{item.product.name}</span>
                              <span className="text-[11px] text-gray font-medium mt-0.5">{[item.variant?.color, item.variant?.storage, item.variant?.condition].filter(Boolean).join(' • ')}</span>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-[13px] font-bold text-navy w-24 text-right">{formatNaira((item.variant?.price || item.product.price) * item.quantity)}</div>
                              <div className="flex items-center border border-border rounded-lg h-8">
                                <button onClick={() => updateCartQty(item.product.id, item.variant?.id, -1)} className="w-8 h-full flex items-center justify-center text-gray border-r border-border">-</button>
                                <span className="w-8 text-center text-[13px] font-bold text-navy">{item.quantity}</span>
                                <button onClick={() => updateCartQty(item.product.id, item.variant?.id, 1)} className="w-8 h-full flex items-center justify-center text-gray border-l border-border">+</button>
                              </div>
                              <button onClick={() => removeFromCart(item.product.id, item.variant?.id)} className="text-gray/40 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="flex-1 flex overflow-hidden bg-white">
                  {/* Left – Order Review */}
                  <div className="flex-1 p-10 border-r border-border overflow-y-auto space-y-8 no-scrollbar">
                    <h3 className="text-[11px] font-bold text-navy uppercase tracking-[0.15em]">Review Order</h3>
                    <table className="w-full">
                      <thead className="text-[10px] text-gray/50 font-bold uppercase tracking-widest border-b border-border text-left">
                        <tr>
                          <th className="py-4 font-bold">Item Description</th>
                          <th className="py-4 font-bold text-center">Qty</th>
                          <th className="py-4 font-bold text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cart.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-5">
                              <div className="flex flex-col">
                                <span className="text-[15px] font-bold text-navy">{item.product.name}</span>
                                <span className="text-[12px] text-gray mt-0.5">{[item.variant?.color, item.variant?.storage, item.variant?.condition].filter(Boolean).join(' • ')}</span>
                              </div>
                            </td>
                            <td className="py-5 text-center text-[14px] text-navy font-medium">{item.quantity}</td>
                            <td className="py-5 text-right text-[14px] font-bold text-navy">{formatNaira((item.variant?.price || item.product.price) * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="space-y-4 pt-4 border-t border-border">
                      <label className="text-[11px] font-bold text-navy uppercase tracking-[0.15em]">Internal Notes</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-0 bg-transparent text-[14px] focus:outline-none min-h-[80px] resize-none" placeholder="Add internal notes..." />
                    </div>
                  </div>

                  {/* Right – Checkout */}
                  <div className="w-[420px] bg-gray-50/30 p-10 overflow-y-auto space-y-8 no-scrollbar border-l border-border">
                    {/* Customer */}
                    <div className="space-y-6">
                      <h3 className="text-[11px] font-bold text-navy uppercase tracking-[0.15em]">Customer Information</h3>
                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-gray uppercase block">Full Name</label>
                        <input
                          required
                          placeholder="Search existing or enter new name…"
                          value={customerName}
                          onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomer(null); setShowCustomerDrop(true) }}
                          onFocus={() => setShowCustomerDrop(true)}
                          onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
                          className="w-full h-10 bg-transparent border-b border-border text-[15px] focus:outline-none focus:border-primary transition-all"
                        />
                        {showCustomerDrop && customerSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                            {customerSuggestions.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onMouseDown={() => selectCustomer(c)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left border-b border-border last:border-0"
                              >
                                <div>
                                  <p className="text-[13px] font-bold text-navy">{c.name}</p>
                                  <p className="text-[11px] text-gray">{c.phone}</p>
                                </div>
                                {c.totalOrders > 0 && (
                                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    {c.totalOrders} order{c.totalOrders !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray uppercase block">Phone Number</label>
                        <input required placeholder="e.g. 08012345678" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full h-10 bg-transparent border-b border-border text-[15px] focus:outline-none focus:border-primary transition-all" />
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-4">
                      <h3 className="text-[11px] font-bold text-navy uppercase tracking-[0.15em]">Payment Method</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Cash', 'POS', 'Transfer', 'Layaway'] as Order['paymentMethod'][]).map((id) => (
                          <button key={id} onClick={() => setPaymentMethod(id)} className={cn('py-2 px-3 rounded-lg text-[12px] font-bold transition-all border', paymentMethod === id ? 'bg-navy text-white border-navy' : 'border-border text-gray hover:border-gray-400')}>{id}</button>
                        ))}
                      </div>
                      {paymentMethod === 'Transfer' && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                          <label className="text-[10px] font-bold text-gray uppercase block mb-1">Ref ID</label>
                          <input placeholder="Reference number" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="w-full h-10 bg-transparent border-b border-border text-[14px] focus:outline-none focus:border-primary transition-all" />
                        </div>
                      )}
                      {paymentMethod === 'Layaway' && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Layaway / Installment</p>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray uppercase block">Deposit Amount (₦)</label>
                            <input type="number" min={1} placeholder="0" value={depositAmount || ''} onChange={(e) => setDepositAmount(Number(e.target.value))} className="w-full h-10 bg-transparent border-b border-amber-300 text-[14px] focus:outline-none transition-all" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray uppercase block flex items-center gap-1"><Calendar size={11} /> Balance Due Date</label>
                            <input type="date" value={layawayDueDate} onChange={(e) => setLayawayDueDate(e.target.value)} className="w-full h-10 bg-transparent border-b border-amber-300 text-[14px] focus:outline-none transition-all" />
                          </div>
                          {depositAmount > 0 && (
                            <div className="text-[12px] text-amber-700 font-medium">
                              Balance: {formatNaira(Math.max(0, totalAmount - depositAmount))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>



                    {/* Totals */}
                    <div className="space-y-4 pt-6 border-t border-border">
                      <div className="space-y-3">
                        <div className="flex justify-between text-[14px]">
                          <span className="text-gray">Subtotal</span>
                          <span className="font-bold text-navy">{formatNaira(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray text-[14px]">Manual Discount</span>
                          <div className="flex items-center border-b border-border focus-within:border-red-400">
                            <span className="text-[12px] font-bold text-gray">₦</span>
                            <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} className="w-24 h-8 bg-transparent text-[14px] text-right font-bold text-red-600 outline-none" />
                          </div>
                        </div>
                        {paymentMethod === 'Layaway' && depositAmount > 0 && (
                          <div className="flex justify-between text-[14px]">
                            <span className="text-amber-600">Deposit Today</span>
                            <span className="font-bold text-amber-600">{formatNaira(depositAmount)}</span>
                          </div>
                        )}
                      </div>
                      <div className="pt-6 border-t border-navy/10 flex justify-between items-end">
                        <span className="text-navy font-bold text-[12px] uppercase tracking-widest pb-1">
                          {paymentMethod === 'Layaway' ? 'Total Payable' : 'Total Payable'}
                        </span>
                        <span className="text-3xl font-black text-navy">{formatNaira(totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 – Success */}
              {step === 3 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white space-y-8">
                  <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center animate-in zoom-in-50 duration-500">
                    <CheckCircle2 size={48} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-navy">Transaction Successful</h3>
                    <p className="text-[14px] text-gray max-w-xs mx-auto leading-relaxed">The order has been recorded and inventory levels updated accordingly.</p>
                  </div>
                  <div className="w-full max-w-sm border border-border rounded-xl divide-y divide-border">
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-gray font-medium uppercase tracking-widest text-[10px]">Amount</span>
                      <span className="text-lg font-bold text-primary">{formatNaira(totalAmount)}</span>
                    </div>
                    <div className="p-4 flex justify-between items-center">
                      <span className="text-gray font-medium uppercase tracking-widest text-[10px]">Method</span>
                      <span className="font-bold text-navy">{paymentMethod}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-sm pt-4">
                    <button onClick={() => {
                      const latest = orders[0]
                      if (latest) handlePrint(latest)
                    }} className="w-full h-12 border border-primary text-primary rounded-xl font-bold text-[14px] hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                      <Printer size={18} /> Print Receipt
                    </button>
                    <button onClick={resetNewOrder} className="w-full h-12 bg-navy text-white rounded-xl font-bold text-[14px] hover:bg-navy/90 transition-all">Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {step < 3 && (
              <div className="p-6 border-t border-border bg-gray-50/50 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray font-bold uppercase tracking-widest">Running Total</span>
                  <span className="text-xl font-black text-navy">{formatNaira(totalAmount)}</span>
                </div>
                <div className="flex gap-3">
                  {step === 2 && (
                    <button onClick={() => setStep(1)} className="h-11 px-6 border border-border bg-white text-navy rounded-lg font-bold text-[14px] hover:bg-gray-100 flex items-center gap-2 transition-all">
                      <ArrowLeft size={18} /> Back
                    </button>
                  )}
                  <button
                    disabled={cart.length === 0}
                    onClick={() => step === 1 ? setStep(2) : handleConfirmOrder()}
                    className="h-11 px-8 bg-primary text-white rounded-lg font-bold text-[14px] hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                  >
                    {step === 1 ? 'Checkout' : isEditingFullOrder ? 'Update Order' : 'Confirm & Pay'} <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)} />
          <div className="relative w-full max-w-[800px] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white border border-border rounded-xl flex items-center justify-center text-primary shadow-sm">
                  <Receipt size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-navy">Order Detail</h2>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  <p className="text-[12px] text-gray font-medium uppercase tracking-widest">Transaction #{selectedOrder.id}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 text-gray hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-3 gap-12 mb-10">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-gray uppercase tracking-[0.2em]">Customer</h4>
                  <div>
                    <p className="text-[15px] font-bold text-navy">{selectedOrder.customerName}</p>
                    <p className="text-[13px] text-gray mt-1">{selectedOrder.customerPhone}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-gray uppercase tracking-[0.2em]">Transaction</h4>
                  <div>
                    <p className="text-[15px] font-bold text-navy">{selectedOrder.paymentMethod} Payment</p>
                    <p className="text-[13px] text-gray mt-1">{new Date(selectedOrder.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-bold text-gray uppercase tracking-[0.2em]">Cashier</h4>
                  <div>
                    <p className="text-[15px] font-bold text-navy">{selectedOrder.staffName}</p>
                    <p className="text-[13px] text-gray mt-1">TechMart Store #1</p>
                  </div>
                </div>
              </div>

              {/* Layaway Info */}
              {selectedOrder.paymentMethod === 'Layaway' && selectedOrder.installment && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-3">Layaway Details</p>
                  <div className="grid grid-cols-3 gap-4 text-[13px]">
                    <div>
                      <p className="text-gray text-[10px] uppercase font-bold">Deposit Paid</p>
                      <p className="font-bold text-navy">{formatNaira(selectedOrder.installment.depositAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray text-[10px] uppercase font-bold">Balance</p>
                      <p className="font-bold text-amber-700">{formatNaira(selectedOrder.installment.remainingAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray text-[10px] uppercase font-bold">Due Date</p>
                      <p className="font-bold text-navy">{new Date(selectedOrder.installment.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border overflow-hidden mb-8">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-border">
                    <tr className="text-[11px] text-gray font-bold uppercase tracking-wider">
                      <th className="px-5 py-4 text-left">Product & Configuration</th>
                      <th className="px-5 py-4 text-center">Qty</th>
                      <th className="px-5 py-4 text-right">Unit Price</th>
                      <th className="px-5 py-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} className="text-[14px]">
                        <td className="px-5 py-4 font-bold text-navy">{item.productName}</td>
                        <td className="px-5 py-4 text-center text-gray">{item.quantity}</td>
                        <td className="px-5 py-4 text-right text-gray">{formatNaira(item.unitPrice)}</td>
                        <td className="px-5 py-4 text-right font-bold text-navy">{formatNaira(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50/50 border-t border-border">
                    <tr>
                      <td colSpan={3} className="px-5 py-2 text-right text-[12px] text-gray font-medium pt-4">Subtotal</td>
                      <td className="px-5 py-2 text-right text-[13px] font-bold text-navy pt-4">{formatNaira(selectedOrder.subtotal)}</td>
                    </tr>
                    {selectedOrder.discountAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 py-2 text-right text-[12px] text-red-500 font-medium">Discount</td>
                        <td className="px-5 py-2 text-right text-[13px] font-bold text-red-500">–{formatNaira(selectedOrder.discountAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="px-5 py-4 text-right text-[13px] font-bold text-primary uppercase">Grand Total</td>
                      <td className="px-5 py-4 text-right text-xl font-bold text-primary">{formatNaira(selectedOrder.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedOrder.notes && (
                <div className="p-5 bg-gray-50 rounded-xl border border-border">
                  <h4 className="text-[11px] font-bold text-gray uppercase tracking-widest mb-2">Internal Notes</h4>
                  <p className="text-[13px] text-navy italic leading-relaxed">"{selectedOrder.notes}"</p>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-border bg-gray-50/50 flex gap-3">
              {selectedOrder.status === 'Completed' && (
                <button
                  onClick={() => setIsRefundModalOpen(true)}
                  className="flex-1 h-12 border border-purple-200 bg-purple-50 text-purple-700 rounded-xl font-bold text-[13px] hover:bg-purple-100 flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw size={16} /> Return & Refund
                </button>
              )}
              <button onClick={handleStartEditFullOrder} className="flex-1 h-12 border border-border bg-white rounded-xl font-bold text-[13px] hover:bg-gray-50 flex items-center justify-center gap-2 transition-all">
                <Edit size={16} /> Edit
              </button>
              <button onClick={() => handlePrint(selectedOrder)} className="flex-1 h-12 bg-primary text-white rounded-xl font-bold text-[14px] hover:bg-primary-dark flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20">
                <Printer size={18} /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Return & Refund Modal ── */}
      {isRefundModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setIsRefundModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[440px] p-8 animate-in zoom-in-95 duration-200 space-y-6">
            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <RotateCcw size={28} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-[18px] font-bold text-navy">Return & Refund</h3>
              <p className="text-[13px] text-gray leading-relaxed">
                Return <span className="font-bold text-navy">{formatNaira(selectedOrder.totalAmount)}</span> to{' '}
                <span className="font-bold text-navy">{selectedOrder.customerName}</span>?
              </p>
              <p className="text-[12px] text-gray">The device will be marked as returned and stock will be restored automatically.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsRefundModalOpen(false)} className="flex-1 h-11 border border-border rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleReturn} className="flex-1 h-11 bg-purple-600 text-white rounded-xl font-bold text-[14px] hover:bg-purple-700 transition-colors">Confirm Return</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable Receipt ── */}
      {printableOrder && (
        <div id="printable-receipt" className="p-8 font-sans">
          <div className="text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-widest">{storeName}</h1>
            <p className="text-[12px]">{address}</p>
            <p className="text-[12px]">Phone: {storePhone}</p>
            <p className="text-[12px]">Email: {storeEmail}</p>
          </div>
          <div className="flex justify-between mb-8">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase">Customer</p>
              <p className="font-bold">{printableOrder.customerName}</p>
              <p>{printableOrder.customerPhone}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-bold uppercase">Receipt Info</p>
              <p className="font-mono font-bold">#{printableOrder.id}</p>
              <p>{new Date(printableOrder.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-black text-left text-[11px] font-bold uppercase">
                <th className="py-2">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {printableOrder.items.map((item, idx) => (
                <tr key={idx} className="text-[13px]">
                  <td className="py-3 font-medium">{item.productName}</td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="py-3 text-right">{formatNaira(item.unitPrice)}</td>
                  <td className="py-3 text-right font-bold">{formatNaira(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-black">
              <tr>
                <td colSpan={3} className="py-2 text-right text-[12px] font-medium pt-4">Subtotal</td>
                <td className="py-2 text-right text-[13px] font-bold pt-4">{formatNaira(printableOrder.subtotal)}</td>
              </tr>
              {printableOrder.discountAmount > 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-right text-[12px] font-medium text-red-600">Discount</td>
                  <td className="py-2 text-right text-[13px] font-bold text-red-600">–{formatNaira(printableOrder.discountAmount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="py-2 text-right text-[14px] font-bold uppercase tracking-wider">Amount Paid</td>
                <td className="py-2 text-right text-lg font-black">{formatNaira(printableOrder.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          {printableOrder.paymentMethod === 'Layaway' && printableOrder.installment && (
            <div className="mb-8 p-4 border-2 border-black rounded">
              <p className="font-bold text-[12px] uppercase mb-2">Layaway Agreement</p>
              <p className="text-[12px]">Deposit: {formatNaira(printableOrder.installment.depositAmount)}</p>
              <p className="text-[12px]">Balance: {formatNaira(printableOrder.installment.remainingAmount)}</p>
              <p className="text-[12px]">Due Date: {new Date(printableOrder.installment.dueDate).toLocaleDateString()}</p>
            </div>
          )}
          <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-[10px] font-bold uppercase mb-1">Payment Method</p>
            <p className="font-bold">{printableOrder.paymentMethod}</p>
          </div>
          <div className="text-center space-y-4 pt-8 border-t border-dashed border-gray-300">
            <p className="text-[13px] font-medium italic">Thank you for shopping with {storeName}!</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em]">{storeEmail}</p>
          </div>
        </div>
      )}
    </div>
  )
}
