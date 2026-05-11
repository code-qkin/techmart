import React, { useState } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import {
  Store,
  Bell,
  Lock,
  Save,
  User,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'

export const Settings: React.FC = () => {
  const { user } = useAuthStore()
  const isSecretary = user?.role === 'secretary'
  const { storeName, address, phone, email, setStoreInfo } = useSettingsStore()
  const [storeForm, setStoreForm] = useState({ storeName, address, phone, email })
  
  const [notifications, setNotifications] = useState({
    lowStock: true,
    newOrder: true,
    dailyReport: false,
    staffLogin: false
  })

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault()
    setStoreInfo(storeForm)
    toast.success("Store settings saved")
  }

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Security credentials updated successfully")
  }

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Profile information updated")
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={isSecretary ? "Personal Settings" : "Settings"} 
        subtitle={isSecretary ? "Manage your profile and security credentials" : "Manage store preferences and account"} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Profile Information (Always Visible) */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center text-gray">
              <User size={18} />
            </div>
            <h3 className="text-[15px] font-bold text-navy">Profile Information</h3>
          </div>
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-navy">Full Name</label>
              <input defaultValue={user?.name} className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-navy">Email Address</label>
              <input disabled value={user?.email} className="w-full h-10 px-3 border border-border rounded-md text-[14px] bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-navy">System Role</label>
              <input disabled value={user?.role.toUpperCase()} className="w-full h-10 px-3 border border-border rounded-md text-[14px] bg-gray-50 text-gray-500 cursor-not-allowed font-bold" />
            </div>
            <button 
              type="submit"
              className="w-full h-11 bg-primary text-white rounded-md font-bold text-[14px] hover:bg-primary-dark flex items-center justify-center gap-2 transition-colors mt-4"
            >
              <Save size={18} /> Update Profile
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {/* Security (Always Visible) */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center text-gray">
                <Lock size={18} />
              </div>
              <h3 className="text-[15px] font-bold text-navy">Security & Password</h3>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-navy">Current Password</label>
                <input type="password" placeholder="••••••••" className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-navy">New Password</label>
                <input type="password" placeholder="••••••••" className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none" />
                <div className="flex gap-1 mt-1.5">
                  <div className="flex-1 h-1 rounded-full bg-success" />
                  <div className="flex-1 h-1 rounded-full bg-success" />
                  <div className="flex-1 h-1 rounded-full bg-success" />
                  <div className="flex-1 h-1 rounded-full bg-gray-200" />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full h-11 bg-primary text-white rounded-md font-bold text-[14px] hover:bg-primary-dark transition-colors mt-2"
              >
                Change Master Key
              </button>
            </form>
          </div>

          {/* Business settings - Hidden from Secretary */}
          {!isSecretary && (
            <>
              {/* Notifications */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="p-5 border-b border-border flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center text-gray">
                    <Bell size={18} />
                  </div>
                  <h3 className="text-[15px] font-bold text-navy">Notifications</h3>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { key: 'lowStock', label: 'Low Stock Alerts', desc: 'Notify when stock below threshold' },
                    { key: 'newOrder', label: 'New Order Alerts', desc: 'Get notified on each new sale' },
                    { key: 'dailyReport', label: 'Daily Sales Report', desc: 'End-of-day summary email' },
                    { key: 'staffLogin', label: 'Staff Login Alerts', desc: 'Alert when staff sign in' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-navy">{item.label}</span>
                        <span className="text-[11px] text-gray">{item.desc}</span>
                      </div>
                      <button 
                        onClick={() => handleToggle(item.key as keyof typeof notifications)}
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-all duration-300 ease-in-out",
                          notifications[item.key as keyof typeof notifications] ? "bg-primary" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
                          notifications[item.key as keyof typeof notifications] ? "left-6" : "left-1"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Store Information */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="p-5 border-b border-border flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center text-gray">
                    <Store size={18} />
                  </div>
                  <h3 className="text-[15px] font-bold text-navy">Store Information</h3>
                </div>
                <form onSubmit={handleSaveStore} className="p-6 space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-navy">Store Name</label>
                    <input
                      value={storeForm.storeName}
                      onChange={(e) => setStoreForm((p) => ({ ...p, storeName: e.target.value }))}
                      className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-navy">Address</label>
                    <textarea
                      value={storeForm.address}
                      onChange={(e) => setStoreForm((p) => ({ ...p, address: e.target.value }))}
                      rows={2}
                      className="w-full p-3 border border-border rounded-md text-[14px] focus:border-primary outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-navy">Phone Number</label>
                      <input
                        value={storeForm.phone}
                        onChange={(e) => setStoreForm((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px] font-bold text-navy">Store Email</label>
                      <input
                        value={storeForm.email}
                        onChange={(e) => setStoreForm((p) => ({ ...p, email: e.target.value }))}
                        className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-navy">Currency</label>
                    <select className="w-full h-10 px-3 border border-border rounded-md text-[14px]">
                      <option>₦ Nigerian Naira (NGN)</option>
                      <option>$ US Dollar (USD)</option>
                      <option>€ Euro (EUR)</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    className="w-full h-11 bg-primary text-white rounded-md font-bold text-[14px] hover:bg-primary-dark flex items-center justify-center gap-2 transition-colors mt-4"
                  >
                    <Save size={18} /> Save Global Changes
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
