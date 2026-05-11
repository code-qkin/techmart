import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down'
  icon: LucideIcon
  iconBg: 'red' | 'green' | 'amber' | 'blue'
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, change, changeType, icon: Icon, iconBg
}) => {
  const bgClasses = {
    red: 'bg-primary/10 text-primary',
    green: 'bg-success/10 text-success',
    amber: 'bg-warning/10 text-warning',
    blue: 'bg-info/10 text-info',
  }

  return (
    <div className="bg-card p-3 lg:p-5 rounded-lg border border-border shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className={cn("w-[38px] h-[38px] rounded-md flex items-center justify-center shrink-0", bgClasses[iconBg])}>
          <Icon size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[12px] text-gray uppercase tracking-wider font-semibold">{label}</span>
          <span className="text-lg lg:text-2xl font-syne font-bold leading-tight">{value}</span>
        </div>
      </div>
      {change && (
        <span className={cn(
          "text-[11px] font-medium",
          changeType === 'up' ? "text-success" : "text-primary"
        )}>
          {change}
        </span>
      )}
    </div>
  )
}
