import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null

  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onCancel} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[400px] animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Top accent bar */}
        <div className={cn('h-1 w-full', isDanger ? 'bg-red-500' : 'bg-amber-400')} />

        <div className="p-7 space-y-5">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 text-gray/40 hover:text-gray hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={16} />
          </button>

          {/* Icon + Title */}
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
              isDanger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
            )}>
              {isDanger ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-navy leading-tight">{title}</h3>
              <p className="text-[12px] text-gray mt-0.5">This action cannot be undone</p>
            </div>
          </div>

          {/* Message */}
          <p className="text-[14px] text-gray leading-relaxed pl-16">{message}</p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 h-11 border border-border bg-white text-navy rounded-xl font-bold text-[14px] hover:bg-gray-50 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={cn(
                'flex-1 h-11 rounded-xl font-bold text-[14px] text-white transition-colors',
                isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
