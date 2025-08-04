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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription?.unsubscribe()
  }, [supabase])

  const handleLogin = async () => {
    // For MVP testing, use email/password authentication
    const email = prompt('Enter your email address:')
    if (!email) return
    
    const password = prompt('Enter password (or create new):')
    if (!password) return

    // Try login first
    const { data: loginData, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    // If login fails, try signup
    if (error && error.message.includes('Invalid login credentials')) {
      // Get full name for new users
      const fullName = prompt('Enter your full name (for display in standings):')
      if (!fullName) return

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })
      
      if (signupError) {
        alert('Signup error: ' + signupError.message)
      } else {
        alert('Account created and logged in!')
        // Set user immediately and refresh page
        setUser(signupData.user)
        window.location.reload()
      }
    } else if (error) {
      alert('Login error: ' + error.message)
    } else {
      // Login successful - update state and refresh
      setUser(loginData.user)
      window.location.reload()
    }
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
          Logga in / Registrera
        </button>
      )}
    </div>
  )
}
