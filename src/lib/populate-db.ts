import { fetchFixtures, fetchLeagueByIdAndSeason, fetchTeamsByLeagueAndSeason } from '@/services/football-api/client';
// Remove unused types: ApiFixtureResponseItem, ApiLeagueInfo, ApiSeason
// Keep types used later in the file if any (re-check needed if logic changes)
import type { /* ApiFixtureResponseItem, ApiLeagueInfo, ApiSeason */ } from '@/services/football-api/types';
import { supabaseServerClient } from './supabase/server';

/**
 * Populates the database with fixtures and related data (league, season, teams, round)
 * for a specific league and season fetched from the API.
 *
 * Uses upsert to avoid duplicates and update existing records.
 *
 * @param leagueId The API league ID.
 * @param seasonYear The season year (e.g., 2024).
 */
export async function populateFixturesForSeason(leagueId: number, seasonYear: number): Promise<void> {
  console.log(`Starting population for league ${leagueId}, season ${seasonYear}...`);

  try {
    // 1. Fetch League and Season Info
    const leagueApiResponse = await fetchLeagueByIdAndSeason(leagueId, seasonYear);

    if (!leagueApiResponse || !leagueApiResponse.response || leagueApiResponse.response.length === 0) {
      console.warn(`No league/season info found for league ${leagueId}, season ${seasonYear}. Cannot proceed.`);
      return;
    }
    // Assuming the API returns only one league item when queried by ID and season
    const leagueData = leagueApiResponse.response[0].league;
    const countryData = leagueApiResponse.response[0].country; // We might need this if linking to a countries table
    const seasonData = leagueApiResponse.response[0].seasons[0]; // Get the specific season details

    if (!leagueData || !seasonData) {
      console.warn(`Incomplete league/season data for league ${leagueId}, season ${seasonYear}. Cannot proceed.`);
      return;
    }

    console.log(`Fetched league info: ${leagueData.name}, Season: ${seasonData.year}`);

    // 2. Upsert Competition
    const { data: competitionDb, error: competitionError } = await supabaseServerClient
      .from('competitions')
      .upsert({
        api_league_id: leagueData.id,
        name: leagueData.name,
        type: leagueData.type, // Correctly accessed here
        country_name: countryData.name, // Use country data from league response
        logo_url: leagueData.logo,
      }, { onConflict: 'api_league_id' })
      .select('id')
      .single();

    if (competitionError) throw new Error(`Competition upsert failed: ${competitionError.message}`);
    if (!competitionDb) throw new Error('Competition upsert did not return data.');
    const competitionId = competitionDb.id;
    console.log(`Upserted competition: ${leagueData.name} (DB ID: ${competitionId})`);

    // 3. Upsert Season
    const { data: seasonDb, error: seasonError } = await supabaseServerClient
      .from('seasons')
      .upsert({
        competition_id: competitionId,
        api_season_year: seasonData.year,
        // Simple naming convention, adjust if needed
        name: `${seasonData.year}/${seasonData.year + 1}`.includes('/') ? `${seasonData.year}/${seasonData.year + 1}` : seasonData.year.toString(),
        start_date: seasonData.start,
        end_date: seasonData.end,
        is_current: seasonData.current,
        coverage_json: seasonData.coverage,
      }, { onConflict: 'competition_id, api_season_year' })
      .select('id')
      .single();

    if (seasonError) throw new Error(`Season upsert failed: ${seasonError.message}`);
    if (!seasonDb) throw new Error('Season upsert did not return data.');
    const seasonId = seasonDb.id;
    console.log(`Upserted season: ${seasonData.year} (DB ID: ${seasonId})`);

    // 1b. Fetch and Upsert All Teams for the Season
    console.log(`Fetching teams for league ${leagueId}, season ${seasonYear}...`);
    const teamsApiResponse = await fetchTeamsByLeagueAndSeason(leagueId, seasonYear);
    const upsertedTeamIds = new Map<number, number>(); // Map api_team_id to its DB ID

    if (teamsApiResponse && teamsApiResponse.response) {
      console.log(`Fetched ${teamsApiResponse.results} teams. Upserting...`);
      for (const teamItem of teamsApiResponse.response) {
        const teamData = teamItem.team;
        if (!teamData) continue;

        const { data: teamDb, error: teamError } = await supabaseServerClient
          .from('teams')
          .upsert({
            api_team_id: teamData.id,
            name: teamData.name,
            logo_url: teamData.logo,
            // Add the new fields
            code: teamData.code,
            country: teamData.country,
            founded: teamData.founded,
            national: teamData.national,
          }, { onConflict: 'api_team_id' })
          .select('id')
          .single();

        if (teamError) {
          console.error(`Team upsert failed for API ID ${teamData.id} (${teamData.name}): ${teamError.message}`);
          // Optionally decide whether to continue or throw
        } else if (teamDb && typeof teamDb.id === 'number') {
          upsertedTeamIds.set(teamData.id, teamDb.id); // Store the DB ID
          // console.log(`Upserted team: ${teamData.name} (DB ID: ${teamDb.id})`); // Less verbose logging
        } else {
          console.warn(`Team upsert for API ID ${teamData.id} did not return a valid ID.`);
        }
      }
      console.log(`Finished upserting ${teamsApiResponse.results} teams.`);
    } else {
      console.warn(`No teams found via API for league ${leagueId}, season ${seasonYear}.`);
    }

    // --- Now Fetch Fixtures ---
    console.log(`Fetching fixtures for league ${leagueId}, season ${seasonYear}...`);
    const fixturesApiResponse = await fetchFixtures(leagueId, seasonYear);

    if (!fixturesApiResponse || !fixturesApiResponse.response || fixturesApiResponse.response.length === 0) {
      console.warn(`No fixtures found for league ${leagueId}, season ${seasonYear}. Population might be incomplete.`);
      // Continue even if no fixtures, as league/season might be valid
    } else {
      console.log(`Fetched ${fixturesApiResponse.results} fixtures from API. Processing...`);
    }

    // Store IDs returned from upserts to use as foreign keys (scoped to this run)
    const upsertedRoundIds = new Map<string, number>(); // Map round name to its DB ID

    // Team IDs are now pre-populated in upsertedTeamIds
    // Process fixtures one by one
    for (const item of fixturesApiResponse.response) {
      // Ensure we have basic data to proceed
      if (!item.league || !item.fixture || !item.teams?.home || !item.teams?.away || !item.league.round) {
        console.warn('Skipping fixture due to missing core data (league info, fixture details, teams, or round name):', item.fixture?.id);
        continue;
      }

      const { league: fixtureLeagueInfo, fixture, teams, goals, score } = item;

      try {
        // 4. Upsert Round (cached based on round name for this run)
        let roundId = upsertedRoundIds.get(fixtureLeagueInfo.round);
        if (roundId === undefined) {
          const { data: roundData, error: roundError } = await supabaseServerClient
            .from('rounds')
            .upsert({
              season_id: seasonId, // Use seasonId obtained earlier
              name: fixtureLeagueInfo.round,
            }, { onConflict: 'season_id, name' })
            .select('id')
            .single();

          if (roundError) throw new Error(`Round upsert failed for "${fixtureLeagueInfo.round}": ${roundError.message}`);
          if (!roundData || typeof roundData.id !== 'number') throw new Error('Round upsert did not return a valid ID.');
          roundId = roundData.id;
          upsertedRoundIds.set(fixtureLeagueInfo.round, roundId);
          console.log(`Upserted round: ${fixtureLeagueInfo.round} (DB ID: ${roundId})`);
        }

        // 5. Get Team DB IDs (Should exist from step 1b)
        const homeTeamId = upsertedTeamIds.get(teams.home.id);
        const awayTeamId = upsertedTeamIds.get(teams.away.id);

        if (homeTeamId === undefined || awayTeamId === undefined) {
          console.warn(`Could not find pre-fetched DB ID for home (${teams.home.id}) or away (${teams.away.id}) team for fixture ${fixture.id}. Skipping fixture upsert.`);
          // Optional: Add fallback upsert here if needed, but ideally shouldn't happen
          continue;
        }

        // 7. Upsert Fixture
        const calculateResult = (home: number | null, away: number | null): '1' | 'X' | '2' | null => {
          if (home === null || away === null) return null;
          if (home > away) return '1';
          if (home < away) return '2';
          return 'X';
        };

        const { error: fixtureError } = await supabaseServerClient
          .from('fixtures')
          .upsert({
            api_fixture_id: fixture.id,
            round_id: roundId,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            kickoff: fixture.date, // Use the ISO string directly
            venue_name: fixture.venue?.name,
            venue_city: fixture.venue?.city,
            status_short: fixture.status.short,
            status_long: fixture.status.long,
            home_goals: goals.home,
            away_goals: goals.away,
            home_goals_ht: score.halftime?.home,
            away_goals_ht: score.halftime?.away,
            result: calculateResult(goals.home, goals.away),
            referee: fixture.referee,
            last_api_update: new Date().toISOString(),
          }, { onConflict: 'api_fixture_id' });

        if (fixtureError) throw new Error(`Fixture upsert failed for API ID ${fixture.id}: ${fixtureError.message}`);

      } catch (innerError: unknown) {
        console.error(`Failed processing fixture API ID ${item.fixture?.id}: ${innerError instanceof Error ? innerError.message : innerError}`);
      }
    } // End loop through fixtures

    console.log(`Successfully finished processing fixtures for league ${leagueId}, season ${seasonYear}.`);

  } catch (error: unknown) {
    console.error(`Error in populateFixturesForSeason for league ${leagueId}, season ${seasonYear}: ${error instanceof Error ? error.message : error}`);
  }
}

// Example Usage (adjust as needed)
// async function runPopulation() {
//   await populateFixturesForSeason(39, 2024);
// }
// runPopulation(); 