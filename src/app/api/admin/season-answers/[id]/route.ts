import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service'
import { logger } from '@/utils/logger'
import { AdminAuditService } from '@/services/adminAuditService'

// DELETE - Delete season answer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: answerId } = await params
    
    const supabase = createSupabaseServiceRoleClient()
    
    const { error } = await supabase
      .from('user_season_answers')
      .delete()
      .eq('id', answerId)
    
    if (error) {
      logger.error('Error deleting season answer:', error)
      return NextResponse.json({ error: 'Failed to delete season answer' }, { status: 500 })
    }
    
    // Log audit
    await AdminAuditService.logSeasonAnswerDelete(answerId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Unexpected error deleting season answer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}