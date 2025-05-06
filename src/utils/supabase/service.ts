import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger'; // Assuming logger is needed/available

// Ensure environment variables are checked on the server-side where this client is used.
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

// Create a single instance of the service role client to be reused.
const supabaseServiceRoleClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    // Recommended settings for server-side clients
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Returns the singleton instance of the Supabase client configured with the service role key.
 * Use this for backend operations requiring elevated privileges, bypassing RLS.
 */
export function getSupabaseServiceRoleClient() {
  // Basic check in case the module somehow loaded without env vars (should be caught above)
  if (!supabaseServiceRoleClient) {
       logger.error("Supabase service role client not initialized.");
       throw new Error("Supabase service role client failed to initialize.");
  }
  return supabaseServiceRoleClient;
}

// Optional: Export the client instance directly if preferred
// export const supabaseServiceRole = supabaseServiceRoleClient; 