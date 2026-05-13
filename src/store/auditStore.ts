import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { AuditLog } from '../types'

interface AuditState {
  addLog: (entry: Omit<AuditLog, 'id' | 'timestamp'>) => void
}

export const useAuditStore = create<AuditState>(() => ({
  addLog: (entry) => {
    supabase.from('audit_logs').insert({
      id: crypto.randomUUID(),
      user_id: entry.userId || null,
      user_name: entry.userName,
      user_role: entry.userRole,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId || null,
      details: entry.details,
      timestamp: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('Audit log failed:', error)
    })
  },
}))
