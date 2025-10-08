'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '../../utils/supabase/client'
import { storeSession, shouldUseAuthWorkaround } from '@/utils/auth/storage'
import { toast } from 'sonner'

interface AuthModalProps {
  children: React.ReactNode
}

export default function AuthModal({ children }: AuthModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    // Listen for password recovery events
    if (!shouldUseAuthWorkaround()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
        if (event === "PASSWORD_RECOVERY") {
          // User came back from email link - they'll be redirected to reset-password page
          console.log('Password recovery event detected')
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [supabase.auth])

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Use the current domain for password reset to match where the user is
      // This ensures Supabase can properly handle the session
      const currentOrigin = window.location.origin
      const redirectTo = `${currentOrigin}/auth/reset-password`
      console.log('Password reset requested with redirectTo:', redirectTo)
      console.log('Current origin:', currentOrigin)
      
      if (shouldUseAuthWorkaround()) {
        // Development workaround: Use direct API call
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            email: email,
            gotrue_meta_security: {
              redirect_to: redirectTo
            }
          }),
        })

        if (response.ok) {
          toast.success('Password reset email sent! Check your inbox.')
          setIsForgotPassword(false)
          setIsLogin(true)
          setEmail('')
        } else {
          const errorData = await response.json()
          toast.error('Error sending reset email: ' + errorData.msg)
        }
      } else {
        // Production: Use Supabase resetPasswordForEmail
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo
        })

        if (error) {
          toast.error('Error sending reset email: ' + error.message)
        } else {
          toast.success('Password reset email sent! Check your inbox.')
          setIsForgotPassword(false)
          setIsLogin(true)
          setEmail('')
        }
      }
    } catch (error) {
      console.error('Network error:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isForgotPassword) {
      return handleForgotPassword(e)
    }
    
    setIsLoading(true)

    try {
      if (shouldUseAuthWorkaround()) {
        // Development workaround: Use direct API calls
        if (isLogin) {
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
            storeSession(authData)
            toast.success('Login successful!')
            setIsOpen(false)
            window.location.reload()
          } else {
            const errorData = await response.json()
            if (response.status === 400 && errorData.msg?.includes('Invalid login credentials')) {
              toast.error('Invalid email or password. Try signing up if you don\'t have an account.')
            } else {
              toast.error('Login error: ' + errorData.msg)
            }
          }
        } else {
          // Signup
          if (!fullName.trim()) {
            toast.error('Please enter your full name')
            return
          }

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
            }
            
            toast.success('Account created and logged in!')
            setIsOpen(false)
            window.location.reload()
          } else {
            const signupError = await signupResponse.json()
            toast.error('Signup error: ' + signupError.msg)
          }
        }
      } else {
        // Production: Use standard Supabase auth
        if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error) {
            if (error.message.includes('Invalid login credentials')) {
              toast.error('Invalid email or password. Try signing up if you don\'t have an account.')
            } else {
              toast.error('Login error: ' + error.message)
            }
          } else if (data.user) {
            toast.success('Login successful!')
            setIsOpen(false)
            window.location.reload()
          }
        } else {
          // Signup
          if (!fullName.trim()) {
            toast.error('Please enter your full name')
            return
          }

          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName }
            }
          })

          if (signupError) {
            toast.error('Signup error: ' + signupError.message)
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
            
            toast.success('Account created! Please check your email for confirmation.')
            setIsOpen(false)
          }
        }
      }
    } catch (error) {
      console.error('Network error:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setRememberMe(false)
    setIsForgotPassword(false)
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setIsForgotPassword(false)
    resetForm()
  }

  const showForgotPassword = () => {
    setIsForgotPassword(true)
    setIsLogin(true)
  }

  const backToLogin = () => {
    setIsForgotPassword(false)
    setIsLogin(true)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isForgotPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account')}
          </DialogTitle>
          <DialogDescription>
            {isForgotPassword 
              ? 'Enter your email address and we\'ll send you a link to reset your password.'
              : (isLogin 
                ? 'Enter your credentials to access your account.' 
                : 'Create a new account to start playing.'
              )
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          <div className="space-y-2">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          {!isForgotPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
              />
            </div>
          )}
          {!isLogin && !isForgotPassword && (
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name
              </Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}
          {isLogin && !isForgotPassword && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label
                htmlFor="rememberMe"
                className="text-sm font-normal cursor-pointer"
              >
                Remember me for 30 days
              </Label>
            </div>
          )}
          <div className="flex flex-col space-y-2">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Please wait...' : 
               (isForgotPassword ? 'Send Reset Link' : 
                (isLogin ? 'Sign In' : 'Create Account'))}
            </Button>
            
            {isForgotPassword ? (
              <Button 
                type="button" 
                variant="ghost" 
                onClick={backToLogin}
                className="w-full"
              >
                Back to Sign In
              </Button>
            ) : (
              <>
                {isLogin && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={showForgotPassword}
                    className="w-full text-sm"
                  >
                    Forgot Password?
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={toggleMode}
                  className="w-full"
                >
                  {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}