// Remove the conditional check entirely
// if (process.env.NODE_ENV !== 'test') {
//   // eslint-disable-next-line @typescript-eslint/no-var-requires
//   require('server-only');
// }

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Ensure these environment variables are set in your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Supabase URL is missing. Please set NEXT_PUBLIC_SUPABASE_URL in your environment variables.');
}

if (!supabaseServiceRoleKey) {
  // Log a warning or throw an error depending on whether service role is strictly required everywhere
  console.warn('Supabase Service Role Key is missing. Certain admin operations might fail.');
  // If service role is absolutely necessary for all server-side operations intended:
  // throw new Error('Supabase Service Role Key is missing. Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables.');
}

/**
 * Creates a Supabase client configured for server-side operations.
 * IMPORTANT: Using the service role key bypasses RLS. Use with caution, typically for admin tasks or trusted server environments.
 * Consider creating clients with specific user contexts if interacting based on user sessions.
 */
export const supabaseServerClient = createClient(
  supabaseUrl,
  // Use the service role key ONLY if it's available and necessary for the operation.
  // Fallback to anon key might be safer if service key is missing and operations allow it,
  // but for admin tasks like bulk inserts, service role is often required.
  supabaseServiceRoleKey || '' // Provide an empty string or handle the missing key case more robustly
  // If you absolutely need the service role key, you should have thrown the error above.
);

// You could also export a function to create clients on demand if needed
// export function createServerClient() {
//   if (!supabaseUrl || !supabaseServiceRoleKey) {
//     throw new Error('Missing Supabase environment variables for server client.');
//   }
//   return createClient(supabaseUrl, supabaseServiceRoleKey);
// } 