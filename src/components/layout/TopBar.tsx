import React, { useState, useRef, useEffect } from 'react'
import { Menu, Bell, LogOut, Package, ShoppingBag, RotateCcw, Tag, Info, CheckCheck } from 'lucide-react'
import { useSidebarStore } from '../../store/sidebarStore'
import { useAuthStore } from '../../store/authStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import { getInitials } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { Link } from 'react-router-dom'
import type { Notification } from '../../types'

const NOTIF_ICONS: Record<Notification['type'], React.ReactNode> = {
  low_stock: <Package size={15} className="text-warning" />,
  new_order: <ShoppingBag size={15} className="text-success" />,
  refund: <RotateCcw size={15} className="text-amber-600" />,
  promo: <Tag size={15} className="text-info" />,
  system: <Info size={15} className="text-gray" />,
}

const timeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export const TopBar: React.FC = () => {
  const { toggle } = useSidebarStore()
  const { user, logout } = useAuthStore()
  const { notifications, markRead, markAllRead, unreadCount } = useNotificationsStore()
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const count = unreadCount()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button onClick={toggle} className="lg:hidden p-2 text-gray hover:bg-gray-100 rounded-md">
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setIsOpen((p) => !p)}
            className="relative p-2 text-gray hover:bg-gray-100 rounded-full transition-colors"
          >
            <Bell size={20} />
            {count > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-white">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-top-2 duration-150 z-50">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-navy text-[14px]">Notifications</h3>
                  {count > 0 && <p className="text-[11px] text-gray">{count} unread</p>}
                </div>
                {count > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-bold text-info hover:underline">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto no-scrollbar divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray text-[13px]">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={cn(
                        'flex gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                        !n.isRead && 'bg-primary/[0.03]'
                      )}
                    >
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        n.type === 'low_stock' ? 'bg-warning/10' :
                        n.type === 'new_order' ? 'bg-success/10' :
                        n.type === 'refund' ? 'bg-amber-100' :
                        n.type === 'promo' ? 'bg-info/10' : 'bg-gray-100'
                      )}>
                        {NOTIF_ICONS[n.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-[13px] font-bold leading-tight', n.isRead ? 'text-gray' : 'text-navy')}>
                            {n.title}
                          </p>
                          {!n.isRead && <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1" />}
                        </div>
                        <p className="text-[12px] text-gray mt-0.5 leading-snug">{n.message}</p>
                        <p className="text-[10px] text-gray/60 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border text-center">
                <Link to="/audit-log" onClick={() => setIsOpen(false)} className="text-[12px] font-bold text-info hover:underline">
                  View Audit Log
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-l border-border pl-4 lg:pl-6">
          <div className="hidden lg:flex flex-col items-end text-right">
            <span className="text-[14px] font-bold text-navy leading-tight">{user?.name}</span>
            <span className="text-[11px] text-gray uppercase tracking-wider font-semibold">{user?.role}</span>
          </div>
          <div className="w-9 h-9 bg-primary/10 text-primary flex items-center justify-center rounded-full font-bold text-[14px]">
            {user ? getInitials(user.name) : '?'}
          </div>
          <button
            onClick={() => { logout() }}
            className="p-2 text-gray hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
