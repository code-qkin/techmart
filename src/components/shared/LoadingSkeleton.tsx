import React from 'react'
import { cn } from '../../lib/utils'

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("animate-pulse bg-gray-200 rounded", className)} />
)

export const LoadingSkeleton: React.FC<{ type: 'table' | 'cards' }> = ({ type }) => {
  if (type === 'table') {
    return (
      <div className="w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-border items-center">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-3 w-1/6" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card p-5 rounded-lg border border-border space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[38px] w-[38px] rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}
