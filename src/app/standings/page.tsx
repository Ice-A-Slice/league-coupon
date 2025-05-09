import React from 'react';
import StandingsTable from '@/components/standings/StandingsTable';
import { logger } from '@/utils/logger'; // Assuming logger is configured for server-side use

// Define the expected structure for a standing entry, matching UserStandingEntry from backend
interface UserStandingEntry {
  user_id: string;
  game_points: number;
  dynamic_points: number;
  combined_total_score: number;
  rank: number;
  // We might need to fetch or join username/avatar if not directly in API response
  // For now, we assume the API might provide it or we handle it later.
}

async function getStandingsData(): Promise<UserStandingEntry[] | null> {
  const loggerContext = { page: '/standings', function: 'getStandingsData' };
  try {
    // REMOVED ARTIFICIAL DELAY - Suspense with loading.tsx handles this now
    // await new Promise(resolve => setTimeout(resolve, 3000));

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${appUrl}/api/standings`, {
      cache: 'no-store', // Ensure fresh data for standings
    });

    if (!response.ok) {
      logger.error(
        { ...loggerContext, status: response.status, statusText: response.statusText },
        `API request failed with status ${response.status}`
      );
      // Optionally, parse error response body if available and useful
      // const errorBody = await response.text();
      // logger.error({ ...loggerContext, errorBody }, 'Error response body');
      return null; // Or throw an error to be caught by Next.js error boundary
    }

    const data: UserStandingEntry[] = await response.json();
    logger.info({ ...loggerContext, count: data.length }, 'Successfully fetched standings data.');
    return data;
  } catch (error) {
    logger.error(
      { ...loggerContext, error: error instanceof Error ? error.message : String(error) },
      'Failed to fetch standings data'
    );
    return null; // Or throw an error
  }
}

export default async function StandingsPage() {
  const standingsData = await getStandingsData();

  // Pass the fetched data to the client component
  // isLoading and error states for the initial fetch are handled here
  // The StandingsTable component itself might have internal loading/error states 
  // if it supports re-fetching or live updates, but initial load is handled by the Server Component.

  if (!standingsData) {
    // This will be caught by the nearest error.tsx or Next.js default error page
    // You could also return a specific error component here
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Standings</h1>
        <p className="text-red-500">Failed to load standings data. Please try again later.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">League Standings</h1>
      {/* The StandingsTable component handles its own display based on props */}
      <StandingsTable standings={standingsData} />
    </div>
  );
}

// Optional: Revalidate data periodically or on demand if standings change frequently
// export const revalidate = 60; // Revalidate every 60 seconds 