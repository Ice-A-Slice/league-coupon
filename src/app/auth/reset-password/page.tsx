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
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Simple approach: just check if we have recovery params
    const checkRecovery = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const hashParams = window.location.hash
      
      console.log('Reset password page - code:', code, 'hash:', hashParams)
      
      // If we have a code or hash params, we're likely in a valid recovery flow
      if (code || hashParams.includes('type=recovery')) {
        setIsReady(true)
      } else if (!shouldUseAuthWorkaround()) {
        // No recovery params, redirect
        toast.error('Invalid password reset link')
        router.push('/')
      } else {
        // Dev mode
        setIsReady(true)
      }
    }
    
    // Wait a bit for Supabase to process
    setTimeout(checkRecovery, 100)
  }, [router, supabase])

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
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })

      if (error) {
        console.error('Password update error:', error)
        toast.error(error.message)
      } else {
        toast.success('Password updated successfully!')
        await supabase.auth.signOut()
        router.push('/')
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>
              Please wait...
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