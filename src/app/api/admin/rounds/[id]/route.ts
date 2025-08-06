import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service'
import { logger } from '@/utils/logger'
import { AdminAuditService } from '@/services/adminAuditService'

// PATCH - Update round settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roundIdStr } = await params
    const roundId = parseInt(roundIdStr, 10)
    
    if (isNaN(roundId)) {
      return NextResponse.json({ error: 'Invalid round ID' }, { status: 400 })
    }
    
    const body = await request.json()
    const { is_bonus_round, cup_activated_at } = body
    
    const supabase = createSupabaseServiceRoleClient()
    
    const updates: Record<string, unknown> = {}
    if (is_bonus_round !== undefined) updates.is_bonus_round = is_bonus_round
    if (cup_activated_at !== undefined) updates.cup_activated_at = cup_activated_at
    
    const { data, error } = await supabase
      .from('betting_rounds')
      .update(updates)
      .eq('id', roundId)
      .select()
      .single()
    
    if (error) {
      logger.error('Error updating round:', error)
      return NextResponse.json({ error: 'Failed to update round' }, { status: 500 })
    }
    
    // Log audit
    await AdminAuditService.logRoundUpdate(roundIdStr, updates)
    if (cup_activated_at !== undefined) {
      await AdminAuditService.logCupActivation(roundIdStr, !!cup_activated_at)
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Unexpected error updating round:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}