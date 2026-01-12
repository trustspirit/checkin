export interface AuditLogEntry {
  id: string
  timestamp: string
  userName: string
  action: 'create' | 'update' | 'delete' | 'check_in' | 'check_out' | 'assign' | 'import'
  targetType: 'participant' | 'group' | 'room'
  targetId: string
  targetName: string
  changes?: Record<string, { from: unknown; to: unknown }>
}

export const writeAuditLog = async (
  userName: string,
  action: AuditLogEntry['action'],
  targetType: AuditLogEntry['targetType'],
  targetId: string,
  targetName: string,
  changes?: AuditLogEntry['changes']
): Promise<boolean> => {
  const entry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    userName,
    action,
    targetType,
    targetId,
    targetName,
    changes
  }

  return window.electronAPI.writeAuditLog(entry)
}

export const readAuditLogs = async (): Promise<AuditLogEntry[]> => {
  return window.electronAPI.readAuditLogs()
}

export const clearAuditLogs = async (): Promise<boolean> => {
  return window.electronAPI.clearAuditLogs()
}
