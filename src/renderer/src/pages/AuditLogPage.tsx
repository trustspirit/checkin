import React, { useState, useEffect } from 'react'
import { readAuditLogs, clearAuditLogs, AuditLogEntry } from '../services/auditLog'
import { useSetAtom } from 'jotai'
import { addToastAtom } from '../stores/toastStore'
import { AuditAction, TargetType, AUDIT_ACTION_LABELS, TARGET_TYPE_LABELS } from '../types'
import { AuditLogSkeleton } from '../components'

function AuditLogPage(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<AuditLogEntry['targetType'] | 'all'>('all')
  const addToast = useSetAtom(addToastAtom)

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const data = await readAuditLogs()
      setLogs(data.reverse())
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all audit logs? This cannot be undone.')) return
    try {
      await clearAuditLogs()
      setLogs([])
      addToast({ type: 'success', message: 'Audit logs cleared' })
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to clear logs' })
    }
  }

  const formatDate = (timestamp: string) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp))
  }

  const getActionLabel = (action: AuditLogEntry['action']): string => {
    return AUDIT_ACTION_LABELS[action as AuditAction] || action
  }

  const getTargetTypeLabel = (targetType: AuditLogEntry['targetType']): string => {
    return TARGET_TYPE_LABELS[targetType as TargetType] || targetType
  }

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.targetType === filter)

  if (isLoading) {
    return <AuditLogSkeleton />
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#050505]">Audit Log</h1>
          <p className="text-[#65676B] mt-1">Track all changes made in the application</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-4 py-2 border border-[#DADDE1] rounded-lg bg-white text-sm font-medium"
          >
            <option value="all">All Types</option>
            <option value="participant">Participants</option>
            <option value="group">Groups</option>
            <option value="room">Rooms</option>
          </select>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="px-4 py-2 border border-[#FA383E] text-[#FA383E] rounded-lg text-sm font-semibold hover:bg-[#FFEBEE] transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#DADDE1] p-12 text-center">
          <div className="text-[#65676B] text-lg">No audit logs found</div>
          <p className="text-[#65676B] mt-2 text-sm">Changes will appear here as they are made</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#DADDE1] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#F0F2F5] border-b border-[#DADDE1]">
              <tr>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Time
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  User
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Action
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Target
                </th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wide text-[#65676B] font-semibold">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-[#DADDE1] last:border-b-0 hover:bg-[#F7F8FA]"
                >
                  <td className="px-4 py-3 text-sm text-[#65676B]">{formatDate(log.timestamp)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[#050505]">{log.userName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-[#E7F3FF] text-[#1877F2] rounded text-xs font-semibold">
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#050505]">{log.targetName}</div>
                    <div className="text-xs text-[#65676B]">
                      {getTargetTypeLabel(log.targetType)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#65676B]">
                    {log.changes && Object.keys(log.changes).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(log.changes).map(([field, change]) => (
                          <div key={field} className="text-xs">
                            <span className="font-medium">{field}:</span>{' '}
                            <span className="text-[#FA383E]">{String(change.from || '-')}</span>
                            {' → '}
                            <span className="text-[#31A24C]">{String(change.to || '-')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AuditLogPage
