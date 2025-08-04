import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service'
import { logger } from '@/utils/logger'

// GET - List all whitelisted emails
export async function GET() {
  try {
    const supabase = createSupabaseServiceRoleClient()
    
    const { data: whitelist, error } = await supabase
      .from('email_whitelist')
      .select('id, email, added_by, added_at, is_active, is_admin')
      .order('added_at', { ascending: false })
    
    if (error) {
      logger.error('Error fetching whitelist:', error)
      return NextResponse.json({ error: 'Failed to fetch whitelist' }, { status: 500 })
    }
    
    return NextResponse.json({ data: whitelist })
  } catch (error) {
    logger.error('Unexpected error fetching whitelist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add emails to whitelist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { emails, addedBy } = body
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Emails array is required' }, { status: 400 })
    }
    
    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validEmails = emails.filter(email => emailRegex.test(email))
    const invalidEmails = emails.filter(email => !emailRegex.test(email))
    
    if (validEmails.length === 0) {
      return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 })
    }
    
    const supabase = createSupabaseServiceRoleClient()
    
    // Prepare data for insertion
    const whitelistEntries = validEmails.map(email => ({
      email: email.toLowerCase(),
      added_by: addedBy || 'admin',
      is_active: true,
      is_admin: false
    }))
    
    // Insert emails (ON CONFLICT DO NOTHING to handle duplicates)
    const { data, error } = await supabase
      .from('email_whitelist')
      .upsert(whitelistEntries, { 
        onConflict: 'email',
        ignoreDuplicates: true 
      })
      .select()
    
    if (error) {
      logger.error('Error adding emails to whitelist:', error)
      return NextResponse.json({ error: 'Failed to add emails' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      added: data?.length || 0,
      validEmails: validEmails.length,
      invalidEmails: invalidEmails.length,
      invalid: invalidEmails
    })
    
  } catch (error) {
    logger.error('Unexpected error adding emails:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}