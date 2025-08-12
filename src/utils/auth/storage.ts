/**
 * Auth storage utilities for managing Supabase sessions
 * This provides a consistent interface for auth storage that works in both dev and production
 */

/**
 * Get the storage key for Supabase auth token
 * Dynamically generates the key based on the Supabase URL
 */
export function getAuthStorageKey(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not defined');
    return 'sb-auth-token'; // Fallback
  }
  
  // Extract host and port from URL
  const hostPort = url.split('://')[1]?.replace(/[.:]/g, '-') || 'unknown';
  return `sb-${hostPort}-auth-token`;
}

/**
 * Get auth session from storage
 */
export function getStoredSession(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const storageKey = getAuthStorageKey();
    const storedAuth = localStorage.getItem(storageKey);
    
    if (storedAuth) {
      const authData = JSON.parse(storedAuth);
      
      // Check if session is expired
      if (authData.expires_at && authData.expires_at * 1000 < Date.now()) {
        // Session expired, remove it
        localStorage.removeItem(storageKey);
        return null;
      }
      
      return authData;
    }
  } catch (error) {
    console.error('Error reading auth session:', error);
  }
  
  return null;
}

/**
 * Store auth session
 */
export function storeSession(authData: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = getAuthStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(authData));
  } catch (error) {
    console.error('Error storing auth session:', error);
  }
}

/**
 * Remove auth session
 */
export function removeSession(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = getAuthStorageKey();
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error removing auth session:', error);
  }
}

/**
 * Check if we should use auth workarounds based on environment
 */
export function shouldUseAuthWorkaround(): boolean {
  // Only use workarounds in local development
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) || 
         Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost'));
}