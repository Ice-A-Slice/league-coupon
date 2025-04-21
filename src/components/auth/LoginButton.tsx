'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function LoginButton() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)

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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
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
