import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * Defines the return shape of the useAuth hook.
 */
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
}

/**
 * Custom hook to manage Supabase user authentication state.
 * 
 * It initializes the user state by checking the current session on mount 
 * and listens for real-time authentication changes (sign-in, sign-out).
 * Fetches the initial user and listens for authentication changes.
 *
 * @returns An object containing the current user and loading state.
 * @property {User | null} user - The current authenticated Supabase user object, or null if not logged in.
 * @property {boolean} isLoading - True while fetching the initial user state, false otherwise.
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const client = createClient();
    let isMounted = true; // Flag to prevent state updates on unmounted component

    // Set loading true initially
    setIsLoading(true);

    // Perform initial user check
    client.auth.getUser().then(({ data: { user: initialUser } }) => {
      if (isMounted) {
        setUser(initialUser ?? null);
        setIsLoading(false); // Set loading false after initial check
      }
    }).catch((error) => {
        console.error("Error fetching initial user:", error);
        if (isMounted) {
            setIsLoading(false); // Ensure loading stops even on error
        }
    });

    // Set up the listener
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (isMounted) {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          // Initial loading is handled by the getUser call, subsequent changes don't affect initial load status.
          // If we needed loading state for *subsequent* auth changes, we'd handle it here.
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return { user, isLoading };
} 