import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Smartphone,
  Layers,
  ShoppingBag,
  Users,
  Settings,
  AlertCircle,
  X,
  UserCheck,
  BarChart2,
  Receipt,
  Shield
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSidebarStore } from '../../store/sidebarStore'
import { useInventory } from '../../hooks/useInventory'
import { cn } from '../../lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Products', icon: Smartphone, path: '/products' },
  { label: 'Inventory', icon: Layers, path: '/inventory' },
  { label: 'Orders', icon: ShoppingBag, path: '/orders' },
  { label: 'Customers', icon: UserCheck, path: '/customers' },
  { label: 'Reports', icon: BarChart2, path: '/reports', adminOnly: true },
  { label: 'Expenses', icon: Receipt, path: '/expenses', adminOnly: true },
  { label: 'Staff', icon: Users, path: '/staff', adminOnly: true },
  { label: 'Audit Log', icon: Shield, path: '/audit-log', adminOnly: true },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore()
  const { isOpen, close } = useSidebarStore()
  const location = useLocation()
  const { inventory } = useInventory()
  const lowStockCount = inventory.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length

  const filteredNavItems = navItems.filter((item) => {
    if (user?.role === 'secretary') {
      return item.path === '/orders' || item.path === '/customers' || item.path === '/settings'
    }
    return true
  })

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={close} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full bg-white border-r border-border z-50 transition-transform duration-300 lg:translate-x-0 w-[240px]',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 logo-badge text-lg">T</div>
              <span className="font-syne font-bold text-xl text-navy">TechMart</span>
            </div>
            <button onClick={close} className="lg:hidden text-gray hover:text-navy">
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto no-scrollbar">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => close()}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors group',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray hover:bg-gray-100 hover:text-navy'
                )}
              >
                <item.icon size={20} className={cn(
                  'group-hover:scale-110 transition-transform',
                  location.pathname === item.path ? 'text-white' : 'text-gray'
                )} />
                <span className="font-medium text-[14px]">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Low Stock Alert */}
          {lowStockCount > 0 && (
            <div className="p-4 mx-4 mb-6 bg-primary-light rounded-lg border border-primary/10">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-primary">Low Stock Alert</p>
                  <p className="text-[11px] text-primary/80 mt-1">{lowStockCount} product{lowStockCount !== 1 ? 's' : ''} need restocking</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
