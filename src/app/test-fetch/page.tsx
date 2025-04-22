import { fetchFixtures } from '@/services/football-api/client';

// This is a Server Component, so fetch requests run on the server.
export default async function TestFetchPage() {
  let fetchStatus = 'Fetching...';
  let fixtureCount = 0;
  let errorMessage = '';

  console.log('--- Attempting to fetch fixtures on /test-fetch page ---');

  try {
    // Example: Fetch Premier League 2024/25 fixtures
    const leagueId = 39;
    const season = 2024;
    const data = await fetchFixtures(leagueId, season);

    if (data && data.response) {
      fixtureCount = data.results; // Use the results count from the API response
      fetchStatus = `Success! Fetched ${fixtureCount} fixtures. Check server console for details.`;
      console.log(`Successfully fetched ${fixtureCount} fixtures for league ${leagueId}, season ${season}.`);
      // Optional: Log a small part of the data to verify structure
      // console.log('Sample fixture data:', data.response[0]);
    } else {
      fetchStatus = 'Fetch completed, but no response data received.';
      console.warn('API call succeeded but response structure might be unexpected:', data);
    }

  } catch (error: any) {
    console.error('--- Error fetching fixtures: ---');
    console.error(error);
    fetchStatus = 'Failed to fetch fixtures. Check server console for error details.';
    errorMessage = error.message || 'An unknown error occurred.';
  }

  console.log('--- Fixture fetch attempt finished ---');

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Test API Fetch</h1>
      <p>Attempting to fetch fixtures for Premier League (ID 39), Season 2024.</p>
      <p>Status: <strong>{fetchStatus}</strong></p>
      {errorMessage && (
        <p style={{ color: 'red' }}>Error: {errorMessage}</p>
      )}
      <p><em>Check the terminal where you ran `npm run dev` for detailed console logs.</em></p>
    </div>
  );
} 