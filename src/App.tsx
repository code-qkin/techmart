import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Products } from './pages/Products'
import { Inventory } from './pages/Inventory'
import { Orders } from './pages/Orders'
import { Staff } from './pages/Staff'
import { Customers } from './pages/Customers'
import { Reports } from './pages/Reports'
import { Expenses } from './pages/Expenses'
import { AuditLog } from './pages/AuditLog'
import { Settings } from './pages/Settings'
import { Suppliers } from './pages/Suppliers'
import { Batches } from './pages/Batches'
import { useAuthStore } from './store/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function PrivateRoute() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()

    // Re-validate session every 10 minutes — catches deactivated accounts mid-session
    const interval = setInterval(initialize, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [initialize])

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/batches" element={<Batches />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}

export default App
