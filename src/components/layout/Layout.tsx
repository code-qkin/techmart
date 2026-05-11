import React from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { useAuthStore } from '../../store/authStore'
import { toast } from 'sonner'

export const Layout: React.FC = () => {
  const { user, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.role === 'secretary' && location.pathname !== '/orders' && location.pathname !== '/settings') {
    toast.error("Access Restricted: Your role only allows Order management and Personal Settings")
    return <Navigate to="/orders" replace />
  }

  if (location.pathname === '/staff' && user.role === 'secretary') {
    toast.error("You don't have permission to access Staff management")
    return <Navigate to="/orders" replace />
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 lg:ml-[240px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-4 lg:p-8 pb-20 lg:pb-8 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
