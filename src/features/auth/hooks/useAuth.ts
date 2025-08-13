import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getStoredSession, shouldUseAuthWorkaround, getAuthStorageKey } from '@/utils/auth/storage';

/**
 * Defines the return shape of the useAuth hook.
 */
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
}

/**
 * Custom hook to manage Supabase user authentication state.
 * 
 * Handles both standard Supabase auth and workarounds for local development issues.
 * In production, uses standard Supabase auth methods.
 * In development with broken auth, falls back to localStorage management.
 *
 * @returns An object containing the current user, loading state, and refresh function.
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const client = createClient();
    
    if (shouldUseAuthWorkaround()) {
      // In development with broken auth, just check localStorage
      const storedAuth = getStoredSession();
      if (storedAuth?.user) {
        setUser(storedAuth.user as User);
      }
    } else {
      // In production, use proper Supabase refresh
      try {
        const { data: { session }, error } = await client.auth.refreshSession();
        if (!error && session) {
          setUser(session.user);
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    }
  }, []);

  useEffect(() => {
    const client = createClient();
    let isMounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    const initializeAuth = async () => {
      // Always set a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      }, 1000);

      try {
        if (shouldUseAuthWorkaround()) {
          // Development workaround: Read from localStorage
          const storedAuth = getStoredSession();
          
          if (storedAuth?.user) {
            if (isMounted) {
              setUser(storedAuth.user as User);
              setIsLoading(false);
            }
          } else {
            if (isMounted) {
              setUser(null);
              setIsLoading(false);
            }
          }

          // Set up interval to check for session changes
          const checkInterval = setInterval(() => {
            if (!isMounted) return;
            
            const currentAuth = getStoredSession();
            const currentUserId = user?.id;
            const storedUserId = (currentAuth?.user as User)?.id;
            
            if (currentUserId !== storedUserId) {
              setUser((currentAuth?.user as User) || null);
            }
          }, 1000);

          // Listen for storage events
          const handleStorageChange = (e: StorageEvent) => {
            if (!isMounted) return;
            
            const storageKey = getAuthStorageKey();
            if (e.key === storageKey) {
              if (e.newValue) {
                try {
                  const authData = JSON.parse(e.newValue);
                  setUser(authData.user as User);
                } catch (error) {
                  console.error('Error parsing storage event:', error);
                }
              } else {
                setUser(null);
              }
            }
          };

          window.addEventListener('storage', handleStorageChange);

          return () => {
            clearTimeout(loadingTimeout);
            clearInterval(checkInterval);
            window.removeEventListener('storage', handleStorageChange);
          };
        } else {
          // Production: Use standard Supabase auth
          const { data: { session }, error } = await client.auth.getSession();
          
          if (!error && session && isMounted) {
            setUser(session.user);
            setIsLoading(false);
          } else if (isMounted) {
            setUser(null);
            setIsLoading(false);
          }

          // Listen for auth state changes
          const { data: { subscription } } = client.auth.onAuthStateChange(
            (event: AuthChangeEvent, session: Session | null) => {
              if (isMounted) {
                setUser(session?.user ?? null);
                
                // Handle email confirmation success
                if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
                  console.log('✅ Email confirmed and user signed in');
                  // You could add a toast notification here if desired
                }
              }
            }
          );

          // Set up token refresh interval (every 30 minutes)
          refreshInterval = setInterval(() => {
            refreshSession();
          }, 30 * 60 * 1000);

          return () => {
            clearTimeout(loadingTimeout);
            subscription?.unsubscribe();
            if (refreshInterval) clearInterval(refreshInterval);
          };
        }
      } catch (error) {
        console.error('Error in auth initialization:', error);
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }

      clearTimeout(loadingTimeout);
    };

    const cleanup = initializeAuth();

    return () => {
      isMounted = false;
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [refreshSession, user?.id]);

  return { user, isLoading, refreshSession };
}