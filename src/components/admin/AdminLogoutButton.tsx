'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function AdminLogoutButton() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Redirect to signin page
      router.push('/auth/signin')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
      // Still redirect even if logout fails
      router.push('/auth/signin')
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="text-red-600 hover:text-red-800 px-3 py-2 rounded-md text-sm font-medium border border-red-300 hover:border-red-400 transition-colors"
    >
      Sign out
    </button>
  )
}