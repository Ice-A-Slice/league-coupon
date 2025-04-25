import { createClient } from '@/utils/supabase/client';

// const supabase = createClient(); // Removed from module scope

/**
 * Retrieves the database ID of the season currently marked as active.
 *
 * @returns {Promise<number | null>} A promise that resolves to the ID of the current season,
 *                                  or null if no current season is found or an error occurs.
 */
export async function getCurrentSeasonId(): Promise<number | null> {
  const supabase = createClient(); // Instantiate client inside the function
  console.log('Fetching current season ID...');
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_current', true)
      .limit(1)
      .single(); // .single() expects exactly one row or returns an error

    if (error) {
      // Handle the case where no row is found specifically (PostgREST error code PGRST116)
      if (error.code === 'PGRST116') {
        console.warn('No season currently marked as active.');
        return null;
      }
      // Log other database errors
      console.error('Error fetching current season ID:', error);
      return null;
    }

    if (!data) {
        console.warn('No data returned for current season query, even without error.');
        return null;
    }

    console.log(`Current season ID found: ${data.id}`);
    return data.id;

  } catch (err) {
    console.error('Unexpected error in getCurrentSeasonId:', err);
    return null;
  }
} 