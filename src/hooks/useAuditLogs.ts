import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AuditLog } from '../types'

export const useAuditLogs = () => {
  return useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500)
      if (error) throw error
      return data.map((row): AuditLog => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userRole: row.user_role,
        action: row.action as AuditLog['action'],
        entity: row.entity as AuditLog['entity'],
        entityId: row.entity_id,
        details: row.details,
        timestamp: row.timestamp,
      }))
    },
  })
}
