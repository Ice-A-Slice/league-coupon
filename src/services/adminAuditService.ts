import { createClient } from '@/utils/supabase/server'
import type { Json } from '@/types/supabase'

export interface AuditLogEntry {
  action: string
  entity_type: string
  entity_id?: string
  details?: Record<string, unknown>
}

export class AdminAuditService {
  static async log(entry: AuditLogEntry) {
    try {
      const supabase = await createClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Failed to get user for audit log:', userError)
        return
      }

      // Insert audit log
      const { error } = await supabase
        .from('admin_audit_logs')
        .insert({
          admin_id: user.id,
          admin_email: user.email || 'unknown',
          action: entry.action,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          details: entry.details as Json
        })

      if (error) {
        console.error('Failed to insert audit log:', error)
      }
    } catch (err) {
      console.error('Error in audit logging:', err)
    }
  }

  // Convenience methods for common actions

  static async logRoundUpdate(roundId: string, changes: Record<string, unknown>) {
    await this.log({
      action: 'update_round',
      entity_type: 'betting_round',
      entity_id: roundId,
      details: changes
    })
  }

  static async logCupActivation(roundId: string, activated: boolean) {
    await this.log({
      action: activated ? 'activate_cup' : 'deactivate_cup',
      entity_type: 'betting_round',
      entity_id: roundId,
      details: { cup_activated: activated }
    })
  }

  static async logDynamicAnswerUpdate(answerId: string, changes: Record<string, unknown>) {
    await this.log({
      action: 'update_dynamic_answer',
      entity_type: 'dynamic_answer',
      entity_id: answerId,
      details: changes
    })
  }

  static async logSeasonAnswerDelete(answerId: string) {
    await this.log({
      action: 'delete_season_answer',
      entity_type: 'user_season_answer',
      entity_id: answerId
    })
  }
}