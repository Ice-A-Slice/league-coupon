import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger'; // Assuming logger is needed/available

/**
 * Creates a fresh Supabase service role client instance.
 * Use this for backend operations requiring elevated privileges, bypassing RLS.
 * 
 * This function reads environment variables each time it's called,
 * ensuring test environments get correct configuration.
 */
export function createSupabaseServiceRoleClient() {
  // Read environment variables fresh each time to support test environments
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    logger.error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
    throw new Error("Server configuration error: Missing Supabase URL.");
  }
  if (!serviceRoleKey) {
    logger.error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("Server configuration error: Missing Supabase Service Role Key.");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Recommended settings for server-side clients
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createSupabaseServiceRoleClient() instead for better test compatibility
 * Kept for backward compatibility during migration
 */
export function getSupabaseServiceRoleClient() {
  return createSupabaseServiceRoleClient();
}

 