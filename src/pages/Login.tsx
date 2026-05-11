import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const { storeName } = useSettingsStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const success = await login(email, password)

      if (success) {
        const user = useAuthStore.getState().user
        toast.success(`Welcome back, ${user?.name}!`)
        navigate(user?.role === 'secretary' ? '/orders' : '/dashboard')
      } else {
        toast.error('Incorrect email or password. Please try again.')
      }
    } catch {
      toast.error('Unable to sign in. Please check your connection and try again.')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 logo-badge text-xl mb-4 shadow-lg shadow-primary/20 text-white font-black">T</div>
          <h1 className="font-syne font-black text-2xl text-navy">{storeName}</h1>
          <p className="text-[13px] text-gray mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-navy">Email address</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-lg border border-border bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 focus:outline-none text-[14px] transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-navy">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 pr-11 rounded-lg border border-border bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 focus:outline-none text-[14px] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray hover:text-navy transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-gray/50 mt-6">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </p>
      </div>
    </div>
  )
}
