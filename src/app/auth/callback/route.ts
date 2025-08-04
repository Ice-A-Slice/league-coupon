import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { logger } from '@/utils/logger'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    // await needed to resolve type inference issue for cookieStore during build
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )
    
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && sessionData?.user?.email) {
      const userEmail = sessionData.user.email.toLowerCase()
      
      // Safety switch: skip whitelist check if disabled
      const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true'
      if (!whitelistEnabled) {
        logger.info(`Whitelist disabled - allowing access for: ${userEmail}`)
        return NextResponse.redirect(`${origin}${next}`)
      }
      
      // Check whitelist using service role client (dynamic import for test compatibility)
      const { createSupabaseServiceRoleClient } = await import('@/utils/supabase/service')
      const serviceClient = createSupabaseServiceRoleClient()
      
      try {
        // Check if email is whitelisted
        const { data: whitelistEntry, error: whitelistError } = await serviceClient
          .from('email_whitelist')
          .select('email, is_active')
          .eq('email', userEmail)
          .eq('is_active', true)
          .single()
        
        if (whitelistError || !whitelistEntry) {
          // Log failed access attempt
          const headers = Object.fromEntries(request.headers.entries())
          try {
            await serviceClient
              .from('auth_attempts')
              .insert({
                email: userEmail,
                ip_address: headers['x-forwarded-for'] || headers['x-real-ip'] || null,
                user_agent: headers['user-agent'] || null
              })
          } catch (err) {
            logger.error('Failed to log auth attempt:', err)
          }
          
          // Sign out the user
          await supabase.auth.signOut()
          
          // Redirect to access denied page
          return NextResponse.redirect(`${origin}/auth/access-denied`)
        }
        
        // User is whitelisted, proceed with normal flow
        logger.info(`Successful authentication for whitelisted user: ${userEmail}`)
        return NextResponse.redirect(`${origin}${next}`)
        
      } catch (error) {
        logger.error('Error checking whitelist:', error)
        // In case of error, sign out user for security
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/auth/auth-code-error`)
      }
    }
  }

  // return the user to an error page with instructions
  console.error('Error exchanging code for session or code missing');
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
} 