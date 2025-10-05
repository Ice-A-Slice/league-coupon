import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/callback',
  '/auth/reset-password',
  '/auth/access-denied',
  '/auth/auth-code-error',
  '/api/health',
  '/api/teams',
  '/api/fixtures',
  '/api/players',
  '/api/players-all',
  '/api/standings',
  '/api/bets',
  '/api/season-answers',
  '/api/hall-of-fame',
  '/api/cron',
  '/api/test',
]

// Define routes that require admin privileges
const adminRoutes = [
  '/admin',
  '/api/admin',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if this is an admin route FIRST
  const isAdminRoute = adminRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  
  // Allow public routes (but not admin routes)
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  
  // Allow public routes (non-admin) without authentication
  if (isPublicRoute && !isAdminRoute) {
    return NextResponse.next()
  }
  
  // Safety switch: disable whitelist via environment variable for non-admin routes
  const whitelistEnabled = process.env.WHITELIST_ENABLED === 'true'
  
  // If whitelist is disabled AND it's not an admin route, allow access without auth
  if (!whitelistEnabled && !isAdminRoute) {
    return NextResponse.next()
  }
  
  // Create Supabase client
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name, options) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user?.email) {
    // Not authenticated, redirect to signin
    const redirectUrl = new URL('/auth/signin', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }
  
  const userEmail = session.user.email.toLowerCase()
  
  // For admin routes, check admin status
  if (isAdminRoute) {
    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabase
      .rpc('is_email_admin', { check_email: userEmail })
    
    if (adminError || !isAdmin) {
      // User is not admin, redirect to signin with admin context and error
      const redirectUrl = new URL('/auth/signin', request.url)
      redirectUrl.searchParams.set('next', pathname)
      redirectUrl.searchParams.set('error', 'admin_unauthorized')
      return NextResponse.redirect(redirectUrl)
    }
  }
  
  // For non-admin routes, check whitelist if enabled
  if (whitelistEnabled && !isAdminRoute) {
    // Check whitelist status using RPC function
    const { data: isWhitelisted, error: whitelistError } = await supabase
      .rpc('is_email_whitelisted', { check_email: userEmail })
    
    if (whitelistError || !isWhitelisted) {
      // User is not whitelisted, redirect to access denied
      return NextResponse.redirect(new URL('/auth/access-denied', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}