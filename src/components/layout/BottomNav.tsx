import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Smartphone, 
  Layers, 
  ShoppingBag, 
  Settings 
} from 'lucide-react'
import { cn } from '../../lib/utils'

const mobileNavItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Products', icon: Smartphone, path: '/products' },
  { label: 'Inventory', icon: Layers, path: '/inventory' },
  { label: 'Orders', icon: ShoppingBag, path: '/orders' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

export const BottomNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex items-center justify-around z-50">
      {mobileNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 transition-colors px-2",
            isActive ? "text-primary" : "text-gray"
          )}
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
