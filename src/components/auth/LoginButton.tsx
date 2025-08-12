'use client'

import React from 'react'
import { createClient } from '../../utils/supabase/client'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { removeSession, shouldUseAuthWorkaround } from '@/utils/auth/storage'
import AuthModal from './AuthModal'

export default function LoginButton() {
  const supabase = createClient()
  const { user } = useAuth() // Use the centralized auth hook


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
        <AuthModal>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
            Sign in
          </button>
        </AuthModal>
      )}
    </div>
  )
}