'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '../../../utils/supabase/client'
import { shouldUseAuthWorkaround } from '@/utils/auth/storage'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  // Log immediately when component renders
  console.log('ResetPasswordPage component rendered')
  
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isValidSession, setIsValidSession] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Log the current URL immediately
    console.log('Reset password page loaded with URL:', window.location.href)
    console.log('Query params:', window.location.search)
    console.log('Hash params:', window.location.hash)
    
    // Check if this is a valid password recovery session
    const checkSession = async () => {
      try {
        if (shouldUseAuthWorkaround()) {
          // In development, we'll assume the session is valid for now
          setIsValidSession(true)
        } else {
          // Check for code parameter (new PKCE flow)
          const urlParams = new URLSearchParams(window.location.search)
          const code = urlParams.get('code')
          
          if (code) {
            console.log('Recovery code detected in URL:', code)
            // Exchange the code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            
            if (!error && data?.session) {
              console.log('Successfully exchanged code for session')
              setIsValidSession(true)
            } else {
              console.error('Error exchanging code:', error)
              // Try letting Supabase handle it automatically
              setIsValidSession(true) // Allow user to proceed anyway
            }
          }
          
          // Also check hash params (old format)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const type = hashParams.get('type')
          const accessToken = hashParams.get('access_token')
          
          if (type === 'recovery' && accessToken) {
            console.log('Valid recovery link detected in hash with token')
            setIsValidSession(true)
          }
          
          // Listen for password recovery events as a fallback
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event, !!session)
            if (event === "PASSWORD_RECOVERY") {
              setIsValidSession(true)
            }
          })

          // If no recovery params in URL and no valid session, redirect
          setTimeout(() => {
            if (!isValidSession && !code && type !== 'recovery') {
              console.log('No valid recovery session found, redirecting...')
              toast.error('Invalid or expired reset link')
              router.push('/')
            }
          }, 3000) // Give Supabase 3 seconds to process

          // Cleanup subscription
          return () => subscription?.unsubscribe()
        }
      } catch (error) {
        console.error('Error checking session:', error)
        toast.error('Error validating reset link')
        router.push('/')
      }
    }

    const cleanup = checkSession()
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.())
    }
  }, [router, supabase.auth, isValidSession])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    setIsLoading(true)

    try {
      if (shouldUseAuthWorkaround()) {
        // Development workaround: simulate password update
        toast.success('Password updated successfully! (Development mode)')
        router.push('/')
      } else {
        // Production: Use Supabase updateUser
        const { error } = await supabase.auth.updateUser({ 
          password: password 
        })

        if (error) {
          toast.error('Error updating password: ' + error.message)
        } else {
          toast.success('Password updated successfully!')
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Network error:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Validating Reset Link</CardTitle>
            <CardDescription>
              Please wait while we validate your password reset link...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                New Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}