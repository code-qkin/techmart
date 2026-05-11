import React, { useState, useMemo } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { useAuditLogs } from '../hooks/useAuditLogs'
import { cn } from '../lib/utils'
import { Search, X, Shield } from 'lucide-react'
import type { AuditLog as AuditLogEntry } from '../types'

const ACTION_COLORS: Record<AuditLogEntry['action'], string> = {
  CREATE: 'bg-success/10 text-success border-success/20',
  UPDATE: 'bg-info/10 text-info border-info/20',
  DELETE: 'bg-primary/10 text-primary border-primary/20',
  LOGIN: 'bg-gray-100 text-gray border-gray-200',
  REFUND: 'bg-amber-100 text-amber-700 border-amber-200',
  STOCK_UPDATE: 'bg-purple-100 text-purple-700 border-purple-200',
}

const ROLE_COLORS: Record<string, string> = {
  ceo: 'bg-amber-100 text-amber-700',
  admin: 'bg-info/10 text-info',
  secretary: 'bg-gray-100 text-gray',
}

const ALL_ACTIONS: AuditLogEntry['action'][] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'REFUND', 'STOCK_UPDATE']
const ALL_ENTITIES: AuditLogEntry['entity'][] = ['Order', 'Product', 'Staff', 'Inventory', 'Expense', 'System']

export const AuditLog: React.FC = () => {
  const { data: logs = [] } = useAuditLogs()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('All')
  const [entityFilter, setEntityFilter] = useState<string>('All')

  const filtered = useMemo(() =>
    logs.filter((l) => {
      const matchAction = actionFilter === 'All' || l.action === actionFilter
      const matchEntity = entityFilter === 'All' || l.entity === entityFilter
      const matchSearch = !search ||
        l.userName.toLowerCase().includes(search.toLowerCase()) ||
        l.details.toLowerCase().includes(search.toLowerCase())
      return matchAction && matchEntity && matchSearch
    }),
    [logs, actionFilter, entityFilter, search]
  )

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" subtitle="Complete record of all staff actions and system events" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_ACTIONS.map((action) => {
          const count = logs.filter((l) => l.action === action).length
          return (
            <button
              key={action}
              onClick={() => setActionFilter(actionFilter === action ? 'All' : action)}
              className={cn(
                'bg-card border border-border rounded-lg p-3 text-center transition-all hover:shadow-md',
                actionFilter === action && 'ring-2 ring-primary'
              )}
            >
              <p className="text-xl font-bold text-navy">{count}</p>
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', ACTION_COLORS[action])}>
                {action}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5">
          <Search size={16} className="text-gray shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user or action details..."
            className="flex-1 bg-transparent border-none focus:outline-none text-[13px]"
          />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-gray" /></button>}
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-4 py-2.5 text-[13px] font-medium text-navy focus:outline-none focus:border-primary"
        >
          <option value="All">All Entities</option>
          {ALL_ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Log Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-16 text-center">
          <Shield size={40} className="text-gray/20 mx-auto mb-3" />
          <p className="text-gray text-[14px]">No log entries found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 border-b border-border">
                <tr>
                  {['Timestamp', 'User', 'Action', 'Entity', 'Details'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-5 py-4 text-[12px] text-gray font-mono whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', ROLE_COLORS[log.userRole] || 'bg-gray-100 text-gray')}>
                          {log.userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-navy leading-tight">{log.userName}</p>
                          <p className="text-[10px] text-gray uppercase">{log.userRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', ACTION_COLORS[log.action])}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-gray font-medium whitespace-nowrap">
                      {log.entity}
                      {log.entityId && <span className="font-mono text-[11px] ml-1 text-gray/60">#{log.entityId}</span>}
                    </td>
                    <td className="px-5 py-4 text-[13px] text-navy max-w-[320px]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border text-[12px] text-gray">
            Showing {filtered.length} of {logs.length} entries
          </div>
        </div>
      )}
    </div>
  )
}
