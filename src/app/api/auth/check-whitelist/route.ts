import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Check current user's whitelist status
export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )
    
    // Get current user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session?.user?.email) {
      return NextResponse.json({ 
        isAuthenticated: false, 
        isWhitelisted: false, 
        isAdmin: false 
      })
    }
    
    const userEmail = session.user.email.toLowerCase()
    
    // Check whitelist and admin status using RPC functions
    const [
      { data: isWhitelisted, error: whitelistError },
      { data: isAdmin, error: adminError }
    ] = await Promise.all([
      supabase.rpc('is_email_whitelisted', { check_email: userEmail }),
      supabase.rpc('is_email_admin', { check_email: userEmail })
    ])
    
    return NextResponse.json({
      isAuthenticated: true,
      isWhitelisted: !whitelistError && !!isWhitelisted,
      isAdmin: !adminError && !!isAdmin,
      email: userEmail
    })
    
  } catch (error) {
    console.error('Error checking whitelist status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}