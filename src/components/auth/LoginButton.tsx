'use client'

import React from 'react'
import { createClient } from '../../utils/supabase/client'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { storeSession, removeSession, shouldUseAuthWorkaround } from '@/utils/auth/storage'

export default function LoginButton() {
  const supabase = createClient()
  const { user } = useAuth() // Use the centralized auth hook

  const handleLogin = async () => {
    // For MVP testing, use email/password authentication
    const email = prompt('Enter your email address:')
    if (!email) return
    
    const password = prompt('Enter password (or create new):')
    if (!password) return

    try {
      if (shouldUseAuthWorkaround()) {
        // Development workaround: Use direct API calls
        // Attempting direct login
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            email: email,
            password: password,
          }),
        })

        if (response.ok) {
          const authData = await response.json()
          // Login successful
          
          // Store session using utility
          storeSession(authData)
          
          alert('Login successful!')
          window.location.reload()
          
        } else {
          const errorData = await response.json()
          // Login failed
          
          if (response.status === 400 && errorData.msg?.includes('Invalid login credentials')) {
            // Try signup for new users
            const fullName = prompt('Login failed. Enter your full name to create new account:')
            if (!fullName) return

            const signupResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              },
              body: JSON.stringify({
                email: email,
                password: password,
                data: { full_name: fullName }
              }),
            })
            
            if (signupResponse.ok) {
              const signupData = await signupResponse.json()
              // Signup successful
              
              // Store session using utility
              storeSession(signupData)
              
              // Ensure profile is created
              try {
                const { data: profileResult } = await supabase
                  .rpc('ensure_profile_exists', {
                    user_id: signupData.user.id,
                    user_email: signupData.user.email,
                    user_full_name: fullName
                  })
                
                if (profileResult && !profileResult.success) {
                  console.error('Profile creation warning:', profileResult.message)
                }
              } catch (profileError) {
                console.error('Profile creation error:', profileError)
                // Don't block the signup, just log the error
              }
              
              alert('Account created and logged in!')
              window.location.reload()
            } else {
              const signupError = await signupResponse.json()
              alert('Signup error: ' + signupError.msg)
            }
          } else {
            alert('Login error: ' + errorData.msg)
          }
        }
      } else {
        // Production: Use standard Supabase auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            // Try signup
            const fullName = prompt('Login failed. Enter your full name to create new account:')
            if (!fullName) return

            const { data: signupData, error: signupError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: fullName }
              }
            })

            if (signupError) {
              alert('Signup error: ' + signupError.message)
            } else if (signupData.user) {
              // Ensure profile is created
              try {
                const { data: profileResult } = await supabase
                  .rpc('ensure_profile_exists', {
                    user_id: signupData.user.id,
                    user_email: signupData.user.email,
                    user_full_name: fullName
                  })
                
                if (profileResult && !profileResult.success) {
                  console.error('Profile creation warning:', profileResult.message)
                }
              } catch (profileError) {
                console.error('Profile creation error:', profileError)
              }
              
              alert('Account created! Please check your email for confirmation.')
            }
          } else {
            alert('Login error: ' + error.message)
          }
        } else if (data.user) {
          alert('Login successful!')
          window.location.reload()
        }
      }
    } catch (error) {
      console.error('Network error:', error)
      alert('Network error. Please try again.')
    }
  }

  const handleLogout = async () => {
    if (shouldUseAuthWorkaround()) {
      // Development workaround: Clear localStorage
      removeSession()
      window.location.reload()
    } else {
      // Production: Use Supabase signOut
      await supabase.auth.signOut()
      window.location.reload()
    }
  }

  // Get user's display name from metadata or fallback to email
  const getUserDisplayName = (user: { user_metadata?: { full_name?: string; name?: string; display_name?: string }; email?: string }): string => {
    if (user?.user_metadata) {
      const metadata = user.user_metadata;
      const name = metadata.full_name || metadata.name || metadata.display_name;
      if (name) return name;
    }
    // Fallback to email prefix if no name in metadata
    return user?.email ? user.email.split('@')[0] : 'User';
  };

  return (
    <div className="flex items-center">
      {user ? (
        <div className="flex items-center">
          <span className="text-sm text-gray-600 hidden sm:inline sm:mr-3">
            Welcome, <span className="font-medium">{getUserDisplayName(user)}</span>
          </span>
          <button
            onClick={handleLogout}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-2 rounded text-sm font-medium text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          Sign in
        </button>
      )}
    </div>
  )
}