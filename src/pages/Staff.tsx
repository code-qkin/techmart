import React, { useState } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { DataTable } from '../components/shared/DataTable'
import { StatusBadge } from '../components/shared/StatusBadge'
import { FAB } from '../components/shared/FAB'
import { useStaff } from '../hooks/useStaff'
import { getInitials } from '../lib/utils'
import {
  Search,
  X,
  Mail,
  Phone,
  Shield,
  UserPlus,
  Edit,
  Power,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { cn } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'
import type { StaffMember } from '../types'
import { toast } from 'sonner'

export const Staff: React.FC = () => {
  const { staff, isLoading, addStaff, deleteStaff, toggleStatus, updateStaff } = useStaff()
  const [filter, setFilter] = useState('All')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member)
    setIsAddModalOpen(true)
  }

  const closePortal = () => {
    setIsAddModalOpen(false)
    setEditingStaff(null)
  }

  const filteredStaff = staff.filter(s => {
    const matchesRole = filter === 'All' || s.role.toLowerCase() === filter.toLowerCase()
    const matchesSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'ceo': return 'bg-amber-100 text-amber-700'
      case 'admin': return 'bg-purple-100 text-purple-700'
      case 'secretary': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const columns: ColumnDef<StaffMember>[] = [
    {
      header: 'Staff Member',
      accessorKey: 'fullName',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0",
            getRoleColor(row.original.role)
          )}>
            {getInitials(row.original.fullName)}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-navy">{row.original.fullName}</span>
            <span className="text-[11px] text-gray md:hidden">{row.original.role}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: ({ getValue }) => (
        <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider", getRoleColor(getValue() as string))}>
          {getValue() as string}
        </span>
      )
    },
    {
      header: 'Email',
      accessorKey: 'email',
      cell: ({ getValue }) => <span className="text-gray hidden md:inline">{getValue() as string}</span>
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ getValue }) => <span className="text-gray hidden lg:inline">{getValue() as string}</span>
    },
    {
      header: 'Status',
      accessorKey: 'isActive',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'Active' : 'Inactive'} />
    },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row.original)}
            className="p-2 text-gray hover:text-navy hover:bg-gray-100 rounded-md transition-colors"
          >
            <Edit size={16} />
          </button>
          {row.original.role !== 'ceo' && (
            <>
              <button
                onClick={() => {
                  toggleStatus(row.original.id)
                  toast.success(`Staff member ${row.original.isActive ? 'deactivated' : 'activated'}`)
                }}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  row.original.isActive ? "text-primary hover:bg-primary-light" : "text-success hover:bg-success/10"
                )}
              >
                <Power size={16} />
              </button>
              <button
                onClick={() => setDeletingStaff(row.original)}
                className="p-2 text-gray hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      )
    }
  ]

  const handleAddStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const email = formData.get('email') as string
    // CEO edits preserve their existing role; for new staff the role comes from the select
    const role = (editingStaff?.role === 'ceo'
      ? 'ceo'
      : (formData.get('role') as StaffMember['role'])) || 'secretary'

    const staffData = {
      fullName: `${formData.get('firstName')} ${formData.get('lastName')}`,
      email,
      phone: formData.get('phone') as string,
      role,
      password: (formData.get('password') as string) || '',
    }

    try {
      if (editingStaff) {
        await updateStaff({ ...editingStaff, ...staffData })
        toast.success("Staff member updated")
      } else {
        await addStaff(staffData)
        toast.success("Staff member added successfully")
      }
      closePortal()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader 
          title="Staff" 
          subtitle="Manage team members and permissions" 
        />
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="hidden md:flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-md font-bold text-[14px] hover:bg-primary-dark transition-colors shadow-sm"
        >
          <UserPlus size={18} /> Add Staff
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-lg border border-border">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
          {['All', 'CEO', 'Admin', 'Secretary'].map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={cn(
                "px-5 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all",
                filter === r 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "bg-transparent text-gray hover:bg-gray-100"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex-1 md:w-64 relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
          <input 
            type="text" 
            placeholder="Search staff by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-border rounded-md text-[13px] focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredStaff} 
        isLoading={isLoading} 
        emptyMessage="No staff members found"
      />

      <FAB onClick={() => setIsAddModalOpen(true)} />

      {/* Delete Confirmation Modal */}
      {deletingStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setDeletingStaff(null)} />
          <div className="relative w-full max-w-[420px] bg-white rounded-xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 space-y-6">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-red-600" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-[18px] font-bold text-navy">Delete Staff Member</h3>
              <p className="text-[13px] text-gray leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <span className="font-bold text-navy">{deletingStaff.fullName}</span>?
              </p>
              <p className="text-[12px] text-red-500 font-medium">
                This removes them from both the app and Supabase authentication. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingStaff(null)}
                className="flex-1 h-11 border border-border rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteStaff(deletingStaff.id)
                    toast.success(`${deletingStaff.fullName} has been deleted`)
                    setDeletingStaff(null)
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to delete staff member'
                    toast.error(msg)
                  }
                }}
                className="flex-1 h-11 bg-red-600 text-white rounded-xl font-bold text-[14px] hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={closePortal} />
          <div className="relative w-full max-w-[500px] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold text-navy">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <button onClick={closePortal} className="p-2 text-gray hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-navy">First Name*</label>
                  <input 
                    name="firstName" 
                    required 
                    defaultValue={editingStaff?.fullName.split(' ')[0]}
                    className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none" 
                    placeholder="John" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-navy">Last Name*</label>
                  <input 
                    name="lastName" 
                    required 
                    defaultValue={editingStaff?.fullName.split(' ')[1]}
                    className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none" 
                    placeholder="Doe" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-navy">Email Address*</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    defaultValue={editingStaff?.email}
                    className="w-full h-10 pl-10 pr-4 border border-border rounded-md text-[14px] focus:border-primary outline-none" 
                    placeholder="username@techmart.ng" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-navy">Phone Number*</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                  <input 
                    name="phone" 
                    required 
                    defaultValue={editingStaff?.phone}
                    className="w-full h-10 pl-10 pr-4 border border-border rounded-md text-[14px] focus:border-primary outline-none" 
                    placeholder="+234 800 000 0000" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-navy">Role*</label>
                {editingStaff?.role === 'ceo' ? (
                  <div className="relative">
                    <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                    <input
                      name="role"
                      value="CEO"
                      disabled
                      className="w-full h-10 pl-10 pr-4 border border-border rounded-md text-[14px] bg-gray-50 text-gray-500 cursor-not-allowed font-bold"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
                    <select
                      name="role"
                      required
                      defaultValue={editingStaff?.role ?? 'secretary'}
                      className="w-full h-10 pl-10 pr-4 border border-border rounded-md text-[14px] appearance-none bg-white focus:border-primary outline-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="secretary">Secretary</option>
                    </select>
                  </div>
                )}
              </div>

              {!editingStaff && (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-navy">Temporary Password*</label>
                  <input name="password" type="password" required minLength={8} className="w-full h-10 px-3 border border-border rounded-md text-[14px] focus:border-primary outline-none" placeholder="Min 8 characters" />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={closePortal}
                  className="flex-1 h-11 border border-border rounded-md font-bold text-[14px] hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-11 bg-primary text-white rounded-md font-bold text-[14px] hover:bg-primary-dark transition-all shadow-lg shadow-primary/10"
                >
                  {editingStaff ? 'Save Changes' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
