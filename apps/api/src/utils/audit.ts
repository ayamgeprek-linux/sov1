// apps/api/src/utils/audit.ts
import { supabase } from '../supabase/client.js'

export interface AuditLogData {
  userId: string
  action: string
  entityType: string
  entityId?: string
  oldData?: any
  newData?: any
  ipAddress?: string
  userAgent?: string
  statusCode?: number
  durationMs?: number
}

export const logAudit = async (data: AuditLogData) => {
  try {
    // Dapatkan user email & role dari userId
    let userEmail = null
    let userRole = null

    if (data.userId) {
      const { data: userData, error } = await supabase
        .from('users')
        .select('email, role')
        .eq('id', data.userId)
        .single()

      if (!error && userData) {
        userEmail = userData.email
        userRole = userData.role
      }
    }

    const auditEntry = {
      user_id: data.userId,
      user_email: userEmail,
      user_role: userRole || 'unknown',
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId || null,
      old_data: data.oldData || null,
      new_data: data.newData || null,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      status_code: data.statusCode || 200,
      duration_ms: data.durationMs || 0,
      created_at: new Date().toISOString()
    }

    console.log('[Audit] 📝 Logging:', auditEntry.action, auditEntry.entity_type)

    const { error } = await supabase
      .from('audit_log')
      .insert(auditEntry)

    if (error) {
      console.error('[Audit] Error inserting:', error)
    }
  } catch (error) {
    console.error('[Audit] Error logging audit:', error)
  }
}