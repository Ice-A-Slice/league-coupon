import { createClient } from '@/utils/supabase/client';
import { shouldUseAuthWorkaround, storeSession, removeSession } from '@/utils/auth/storage';

/**
 * Authentication service that handles both development workarounds and production auth
 */
export class AuthService {
  private static instance: AuthService;
  private client = createClient();

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ user: any; error: any }> {
    if (shouldUseAuthWorkaround()) {
      // Development workaround
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          const authData = await response.json();
          storeSession(authData);
          return { user: authData.user, error: null };
        } else {
          const errorData = await response.json();
          return { user: null, error: errorData };
        }
      } catch (error) {
        return { user: null, error: { message: 'Network error' } };
      }
    } else {
      // Production
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });
      return { user: data?.user, error };
    }
  }

  /**
   * Sign up new user
   */
  async signUp(email: string, password: string, metadata?: any): Promise<{ user: any; error: any }> {
    if (shouldUseAuthWorkaround()) {
      // Development workaround
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({
            email,
            password,
            data: metadata,
          }),
        });

        if (response.ok) {
          const authData = await response.json();
          storeSession(authData);
          return { user: authData.user, error: null };
        } else {
          const errorData = await response.json();
          return { user: null, error: errorData };
        }
      } catch (error) {
        return { user: null, error: { message: 'Network error' } };
      }
    } else {
      // Production
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });
      return { user: data?.user, error };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    if (shouldUseAuthWorkaround()) {
      removeSession();
    } else {
      await this.client.auth.signOut();
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<{ session: any; error: any }> {
    if (shouldUseAuthWorkaround()) {
      const storedSession = require('@/utils/auth/storage').getStoredSession();
      return { session: storedSession, error: null };
    } else {
      return await this.client.auth.getSession();
    }
  }

  /**
   * Refresh current session
   */
  async refreshSession(): Promise<{ session: any; error: any }> {
    if (shouldUseAuthWorkaround()) {
      // In development, just return the stored session
      const storedSession = require('@/utils/auth/storage').getStoredSession();
      return { session: storedSession, error: null };
    } else {
      return await this.client.auth.refreshSession();
    }
  }
}