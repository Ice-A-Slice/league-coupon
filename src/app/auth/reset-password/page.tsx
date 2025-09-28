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
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isValidSession, setIsValidSession] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if this is a valid password recovery session
    const checkSession = async () => {
      try {
        if (shouldUseAuthWorkaround()) {
          // In development, we'll assume the session is valid for now
          setIsValidSession(true)
        } else {
          // First check if we already have a session (user came from email link)
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (!error && session?.user) {
            // User has a valid session, allow password reset
            console.log('Valid session found for password reset')
            setIsValidSession(true)
          } else {
            // Listen for password recovery events (backup method)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
              console.log('Auth state change:', event, !!session)
              if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session?.user)) {
                setIsValidSession(true)
              } else if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
                toast.error('Invalid or expired password reset link')
                router.push('/')
              }
            })

            // Cleanup subscription
            return () => subscription?.unsubscribe()
          }
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
  }, [router, supabase.auth])

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
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