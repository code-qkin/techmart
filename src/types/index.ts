export interface VariantUnit {
  imei: string
  supplier?: string
}

export interface ProductVariant {
  id: string // SKU
  label?: string  // free-form label for custom variant types (e.g. "Privacy", "Type-C")
  color?: string
  storage?: string
  ram?: string
  condition: 'New' | 'Open Box' | 'Pre-owned'
  stock: number
  price?: number
  costPrice?: number
  units?: VariantUnit[]  // per-unit IMEI + supplier tracking
}

export interface Batch {
  id: string
  productId: string
  variantId?: string
  supplier?: string
  quantityReceived: number
  quantityRemaining: number
  costPrice: number
  sellPrice?: number
  receivedAt: string
  notes?: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  category: 'Phones' | 'Laptops' | 'Tablets' | 'Accessories'
  brand: string
  price: number
  costPrice?: number
  stock: number
  lowStockThreshold: number
  imageUrl?: string
  description?: string
  emoji: string
  variants?: ProductVariant[]
  supplier?: string
  createdAt: string
  stockUpdatedAt?: string
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  costPrice?: number
  subtotal: number
  color?: string
  storage?: string
  condition?: string
  variantId?: string
  imei?: string
  supplier?: string
  batchId?: string
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
  unit?: VariantUnit
  batchId?: string
  batchCostPrice?: number
  batchSellPrice?: number
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
