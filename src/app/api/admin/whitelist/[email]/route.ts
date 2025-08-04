import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service'
import { logger } from '@/utils/logger'

// DELETE - Remove email from whitelist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email: rawEmail } = await params
    const email = decodeURIComponent(rawEmail).toLowerCase()
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    
    const supabase = createSupabaseServiceRoleClient()
    
    // Check if email exists
    const { data: existing, error: checkError } = await supabase
      .from('email_whitelist')
      .select('email')
      .eq('email', email)
      .single()
    
    if (checkError || !existing) {
      return NextResponse.json({ error: 'Email not found in whitelist' }, { status: 404 })
    }
    
    // Delete the email
    const { error: deleteError } = await supabase
      .from('email_whitelist')
      .delete()
      .eq('email', email)
    
    if (deleteError) {
      logger.error('Error removing email from whitelist:', deleteError)
      return NextResponse.json({ error: 'Failed to remove email' }, { status: 500 })
    }
    
    logger.info(`Removed email from whitelist: ${email}`)
    return NextResponse.json({ success: true, message: `Removed ${email} from whitelist` })
    
  } catch (error) {
    logger.error('Unexpected error removing email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}