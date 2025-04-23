'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { User } from '@supabase/supabase-js'

export default function LoginButton() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Auth error:', error)
      }

      setUser(session?.user ?? null)
    }

    getUser()
  }, [supabase])

  const handleLogin = async () => {
    // Explicitly set the redirect URL for local development
    // This is necessary because Vercel CLI environment variables might override .env.local
    // for NEXT_PUBLIC_SITE_URL when determining the default redirect URL.
    // TODO: Investigate Vercel env variable precedence vs .env.local for OAuth redirects.
    const redirectURL = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000/auth/callback' 
      : undefined; // Let Supabase handle it in production (using Site URL or Vercel URL)

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectURL,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="flex flex-col gap-2 items-start">
      {user ? (
        <>
          <p className="text-sm text-gray-600">Inloggad som {user.email}</p>
          <button
            onClick={handleLogout}
            className="bg-gray-200 px-4 py-1 rounded hover:bg-gray-300"
          >
            Logga ut
          </button>
        </>
      ) : (
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
        >
          Logga in med Google
        </button>
      )}
    </div>
  )
}
