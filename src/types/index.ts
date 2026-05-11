export interface ProductVariant {
  id: string // SKU
  color?: string
  storage?: string
  ram?: string
  condition: 'New' | 'Open Box' | 'Pre-owned'
  stock: number
  price?: number
}

export interface Product {
  id: string
  name: string
  category: 'Phones' | 'Laptops' | 'Tablets' | 'Accessories'
  brand: string
  price: number
  stock: number
  lowStockThreshold: number
  imageUrl?: string
  description?: string
  emoji: string
  variants?: ProductVariant[]
  supplier?: string
  createdAt: string
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  subtotal: number
  color?: string
  storage?: string
  condition?: string
  variantId?: string
}

export interface Installment {
  depositAmount: number
  remainingAmount: number
  dueDate: string
  isPaid: boolean
  paidAt?: string
}

export interface Order {
  id: string
  staffId: string
  staffName: string
  customerName: string
  customerPhone: string
  items: OrderItem[]
  subtotal: number
  taxAmount: number
  discountAmount: number
  promoCode?: string
  totalAmount: number
  paymentMethod: 'Cash' | 'POS' | 'Transfer' | 'Layaway'
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial'
  transactionReference?: string
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled' | 'Refunded' | 'Returned'
  installment?: Installment
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface StaffMember {
  id: string
  fullName: string
  role: 'ceo' | 'admin' | 'secretary'
  email: string
  phone: string
  joinedDate: string
  isActive: boolean
}

export interface CartItem {
  product: Product
  quantity: number
  variant?: ProductVariant
}

export type StockStatus = 'in' | 'low' | 'out'

// ── New feature types ──────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  totalOrders: number
  totalSpent: number
  lastOrderDate?: string
  notes?: string
  createdAt: string
}

export type ExpenseCategory = 'Rent' | 'Utilities' | 'Salaries' | 'Restocking' | 'Marketing' | 'Other'

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  recordedBy: string
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  userRole: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'REFUND' | 'STOCK_UPDATE'
  entity: 'Order' | 'Product' | 'Staff' | 'Inventory' | 'Expense' | 'System'
  entityId?: string
  details: string
  timestamp: string
}

export interface Notification {
  id: string
  type: 'low_stock' | 'new_order' | 'refund' | 'promo' | 'system'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
}
