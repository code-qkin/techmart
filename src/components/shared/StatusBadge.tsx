import React from 'react'
import { cn } from '../../lib/utils'

interface StatusBadgeProps {
  status: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyles = () => {
    const s = status.toLowerCase()
    if (s === 'completed' || s === 'in stock' || s === 'in') {
      return 'bg-success/10 text-success'
    }
    if (s === 'pending' || s === 'low stock' || s === 'low') {
      return 'bg-warning/10 text-warning'
    }
    if (s === 'cancelled' || s === 'out of stock' || s === 'out') {
      return 'bg-primary/10 text-primary'
    }
    if (s === 'refunded') {
      return 'bg-amber-100 text-amber-700'
    }
    if (s === 'returned') {
      return 'bg-purple-100 text-purple-700'
    }
    if (s === 'inactive') {
      return 'bg-gray/10 text-gray'
    }
    return 'bg-gray/10 text-gray'
  }

  const label = status === 'in' ? 'In Stock' : status === 'low' ? 'Low Stock' : status === 'out' ? 'Out of Stock' : status

  return (
    <span className={cn(
      "text-[11px] px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap",
      getStyles()
    )}>
      {label}
    </span>
  )
}
