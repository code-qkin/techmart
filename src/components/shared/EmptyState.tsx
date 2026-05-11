import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon, title, description, actionLabel, onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <div className="w-16 h-16 bg-gray/10 rounded-full flex items-center justify-center mb-4">
        <Icon size={32} className="text-gray" />
      </div>
      <h3 className="text-[15px] font-syne font-bold text-navy mb-1">{title}</h3>
      <p className="text-[13px] text-gray mb-6 max-w-[240px]">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-primary text-white text-[13px] font-semibold px-6 py-2.5 rounded-md hover:bg-primary-dark transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
