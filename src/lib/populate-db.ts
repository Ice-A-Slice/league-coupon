import { fetchFixtures, fetchLeagueByIdAndSeason, fetchTeamsByLeagueAndSeason, fetchAllPlayersByLeagueAndSeason } from '@/services/football-api/client';
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
    console.log(`\n🏈 TEAMS PROCESSING PHASE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Fetching teams for league ${leagueId}, season ${seasonYear}...`);
    
    const teamsApiResponse = await fetchTeamsByLeagueAndSeason(leagueId, seasonYear);
    const upsertedTeamIds = new Map<number, number>(); // Map api_team_id to its DB ID
    let teamsProcessed = 0;
    let teamsSuccessful = 0;
    let teamsFailed = 0;

    if (teamsApiResponse && teamsApiResponse.response) {
      console.log(`✅ Fetched ${teamsApiResponse.results} teams from API. Processing each team...`);
      
      for (const teamItem of teamsApiResponse.response) {
        const teamData = teamItem.team;
        if (!teamData) {
          console.warn(`⚠️  Skipping team with missing data`);
          continue;
        }

        teamsProcessed++;
        console.log(`\n🔄 Processing team ${teamsProcessed}/${teamsApiResponse.results}: ${teamData.name} (API ID: ${teamData.id})`);
        
        // Log the team data being upserted
        console.log(`   Data: {api_team_id: ${teamData.id}, name: "${teamData.name}", code: "${teamData.code}", country: "${teamData.country}", founded: ${teamData.founded}}`);

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
          teamsFailed++;
          console.error(`❌ Team upsert FAILED for API ID ${teamData.id} (${teamData.name}): ${teamError.message}`);
          console.error(`   Error code: ${teamError.code}`);
          console.error(`   Error details: ${teamError.details}`);
        } else if (teamDb && typeof teamDb.id === 'number') {
          teamsSuccessful++;
          upsertedTeamIds.set(teamData.id, teamDb.id); // Store the DB ID
          console.log(`✅ Team upserted successfully: ${teamData.name} -> DB ID: ${teamDb.id}`);
        } else {
          teamsFailed++;
          console.warn(`⚠️  Team upsert for API ID ${teamData.id} (${teamData.name}) did not return a valid DB ID. Response:`, teamDb);
        }
      }
      
      console.log(`\n📊 TEAMS PROCESSING SUMMARY:`);
      console.log(`   Total processed: ${teamsProcessed}`);
      console.log(`   Successful: ${teamsSuccessful}`);
      console.log(`   Failed: ${teamsFailed}`);
      console.log(`   Mapped team IDs: ${upsertedTeamIds.size}`);
      
      // Log the team mapping for debugging
      console.log(`\n🗺️  TEAM ID MAPPING:`);
      for (const [apiId, dbId] of upsertedTeamIds.entries()) {
        console.log(`   API ID ${apiId} -> DB ID ${dbId}`);
      }
    } else {
      console.warn(`❌ No teams found via API for league ${leagueId}, season ${seasonYear}.`);
      console.warn(`   API Response:`, teamsApiResponse);
    }

    // 1c. Fetch and Upsert All Players for the Season
    console.log(`\n⚽ PLAYERS PROCESSING PHASE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Fetching players for league ${leagueId}, season ${seasonYear}...`);
    
    const allPlayersApiResponse = await fetchAllPlayersByLeagueAndSeason(leagueId, seasonYear);
    let playersProcessed = 0;
    let playersSuccessful = 0;
    let playersFailed = 0;
    let statsLinksCreated = 0;
    let statsLinksFailed = 0;

    if (allPlayersApiResponse) {
      console.log(`✅ Fetched ${allPlayersApiResponse.length} player entries from API. Processing...`);
      
      const BATCH_SIZE = 100; 
      let upsertPromises: Promise<void>[] = [];

      for (let i = 0; i < allPlayersApiResponse.length; i++) {
        const playerItem = allPlayersApiResponse[i];
        const playerData = playerItem.player;
        const statsData = playerItem.statistics;
        if (!playerData || !statsData) continue; // Skip if core player or stats array is missing

        // Chain the promises: First upsert player, then process stats
        const processPlayerAndStats = async () => {
          playersProcessed++;
          if (playersProcessed % 100 === 0) {
            console.log(`   📊 Processed ${playersProcessed}/${allPlayersApiResponse.length} players...`);
          }
          
          // 1. Upsert Player Profile
          const { data: playerDb, error: playerError } = await supabaseServerClient
            .from('players')
            .upsert({
              api_player_id: playerData.id,
              name: playerData.name,
              firstname: playerData.firstname,
              lastname: playerData.lastname,
              age: playerData.age,
              nationality: playerData.nationality,
              height: playerData.height,
              weight: playerData.weight,
              injured: playerData.injured,
              photo_url: playerData.photo,
              last_api_update: new Date().toISOString(),
            }, { onConflict: 'api_player_id' })
            .select('id') // Select the DB ID
            .single();

          if (playerError) {
            playersFailed++;
            console.error(`❌ Player profile upsert failed for API ID ${playerData.id} (${playerData.name}): ${playerError.message}`);
            return; // Stop processing stats for this player if profile upsert failed
          }
          if (!playerDb || typeof playerDb.id !== 'number') {
            playersFailed++;
            console.warn(`⚠️  Player profile upsert for API ID ${playerData.id} (${playerData.name}) did not return a valid DB ID. Cannot link stats.`);
            return; // Stop processing stats
          }
          
          playersSuccessful++;
          const playerDbId = playerDb.id;

          // 2. Process Statistics (Link Player-Team-Season)
          for (const stat of statsData) {
            if (!stat.team || !stat.league || stat.league.season !== seasonYear) continue; // Skip if team missing or stat is for wrong season
            
            const teamApiId = stat.team.id;
            if (teamApiId === null) continue; // Skip if no team API ID
            
            const teamDbId = upsertedTeamIds.get(teamApiId); // Get Team DB ID from map populated earlier

            if (teamDbId === undefined) {
              statsLinksFailed++;
              console.warn(`⚠️  Cannot link player ${playerData.name} (${playerData.id}) to team ${teamApiId} for season ${seasonId}: Team DB ID not found in map.`);
              continue; // Skip this stat link if team wasn't found/upserted earlier
            }

            // 3. Upsert into player_statistics linking table
            const { error: statsLinkError } = await supabaseServerClient
              .from('player_statistics')
              .upsert({
                player_id: playerDbId,
                team_id: teamDbId,
                season_id: seasonId, // Use the seasonId from the beginning of the main function
                // Add basic stats later if needed, e.g.:
                // appearances: stat.games?.appearences,
                // position: stat.games?.position,
              }, { onConflict: 'player_id, team_id, season_id' }); // Unique constraint

            if (statsLinkError) {
              statsLinksFailed++;
              console.error(`❌ Failed to upsert player_statistics link for player ${playerData.name} (${playerDbId}), team ${teamDbId}, season ${seasonId}: ${statsLinkError.message}`);
            } else {
              statsLinksCreated++;
            }
          }
        };
        
        upsertPromises.push(processPlayerAndStats()); // Add the async function call to the batch

        // If the batch is full or it's the last item, execute the batch
        if (upsertPromises.length >= BATCH_SIZE || i === allPlayersApiResponse.length - 1) {
          console.log(`Executing batch of ${upsertPromises.length} player profile/stats upserts...`);
          await Promise.all(upsertPromises);
          upsertPromises = []; // Reset promises for the next batch
        }
      }

      console.log(`\n📊 PLAYERS PROCESSING SUMMARY:`);
      console.log(`   Total processed: ${playersProcessed}`);
      console.log(`   Player profiles successful: ${playersSuccessful}`);
      console.log(`   Player profiles failed: ${playersFailed}`);
      console.log(`   Stats links created: ${statsLinksCreated}`);
      console.log(`   Stats links failed: ${statsLinksFailed}`);
    } else {
      console.warn(`❌ Could not fetch players for league ${leagueId}, season ${seasonYear}.`);
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

    console.log(`\n🏟️  FIXTURES PROCESSING PHASE`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing ${fixturesApiResponse.response.length} fixtures...`);
    
    let fixturesProcessed = 0;
    let fixturesSuccessful = 0;
    let fixturesFailed = 0;
    let fixturesSkipped = 0;
    
    // Team IDs are now pre-populated in upsertedTeamIds
    // Process fixtures one by one
    for (const item of fixturesApiResponse.response) {
      fixturesProcessed++;
      
      // Ensure we have basic data to proceed
      if (!item.league || !item.fixture || !item.teams?.home || !item.teams?.away || !item.league.round) {
        fixturesSkipped++;
        console.warn(`⚠️  Fixture ${fixturesProcessed}: Skipping due to missing core data (league info, fixture details, teams, or round name): API ID ${item.fixture?.id}`);
        continue;
      }

      const { league: fixtureLeagueInfo, fixture, teams, goals, score } = item;
      console.log(`\n🔄 Processing fixture ${fixturesProcessed}/${fixturesApiResponse.response.length}: ${teams.home.name} vs ${teams.away.name} (API ID: ${fixture.id})`);
      console.log(`   Round: ${fixtureLeagueInfo.round}, Date: ${fixture.date}`);
      console.log(`   Home Team API ID: ${teams.home.id}, Away Team API ID: ${teams.away.id}`);

      try {
        // 4. Upsert Round (cached based on round name for this run)
        let roundId = upsertedRoundIds.get(fixtureLeagueInfo.round);
        console.log(`   🔄 Round processing: "${fixtureLeagueInfo.round}"`);
        
        if (roundId === undefined) {
          console.log(`   ➕ Creating new round: "${fixtureLeagueInfo.round}" for season ${seasonId}`);
          
          const { data: roundData, error: roundError } = await supabaseServerClient
            .from('rounds')
            .upsert({
              season_id: seasonId, // Use seasonId obtained earlier
              name: fixtureLeagueInfo.round,
            }, { onConflict: 'season_id, name' })
            .select('id')
            .single();

          if (roundError) {
            console.error(`   ❌ Round upsert FAILED for "${fixtureLeagueInfo.round}": ${roundError.message}`);
            throw new Error(`Round upsert failed for "${fixtureLeagueInfo.round}": ${roundError.message}`);
          }
          if (!roundData || typeof roundData.id !== 'number') {
            console.error(`   ❌ Round upsert did not return valid data:`, roundData);
            throw new Error('Round upsert did not return a valid ID.');
          }
          roundId = roundData.id;
          upsertedRoundIds.set(fixtureLeagueInfo.round, roundId);
          console.log(`   ✅ Round created: "${fixtureLeagueInfo.round}" -> DB ID: ${roundId}`);
        } else {
          console.log(`   ♻️  Using cached round: "${fixtureLeagueInfo.round}" -> DB ID: ${roundId}`);
        }

        // 5. Get Team DB IDs (Should exist from step 1b)
        const homeTeamId = upsertedTeamIds.get(teams.home.id);
        const awayTeamId = upsertedTeamIds.get(teams.away.id);
        
        console.log(`   🔍 Looking up team DB IDs:`);
        console.log(`      Home team ${teams.home.name} (API ID: ${teams.home.id}) -> DB ID: ${homeTeamId}`);
        console.log(`      Away team ${teams.away.name} (API ID: ${teams.away.id}) -> DB ID: ${awayTeamId}`);

        if (homeTeamId === undefined || awayTeamId === undefined) {
          fixturesFailed++;
          console.error(`❌ Could not find pre-fetched DB ID for teams in fixture ${fixture.id}:`);
          console.error(`   Home team ${teams.home.name} (API ID: ${teams.home.id}): ${homeTeamId === undefined ? 'NOT FOUND' : homeTeamId}`);
          console.error(`   Away team ${teams.away.name} (API ID: ${teams.away.id}): ${awayTeamId === undefined ? 'NOT FOUND' : awayTeamId}`);
          console.error(`   Available team mappings: ${Array.from(upsertedTeamIds.keys()).join(', ')}`);
          continue;
        }

        // 7. Upsert Fixture
        const calculateResult = (home: number | null, away: number | null): '1' | 'X' | '2' | null => {
          if (home === null || away === null) return null;
          if (home > away) return '1';
          if (home < away) return '2';
          return 'X';
        };

        const fixtureData = {
          api_fixture_id: fixture.id,
          round_id: roundId,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff: fixture.date,
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
        };
        
        console.log(`   💾 Upserting fixture data:`, {
          api_fixture_id: fixtureData.api_fixture_id,
          round_id: fixtureData.round_id,
          home_team_id: fixtureData.home_team_id,
          away_team_id: fixtureData.away_team_id,
          kickoff: fixtureData.kickoff,
          status: fixtureData.status_short
        });

        const { error: fixtureError } = await supabaseServerClient
          .from('fixtures')
          .upsert(fixtureData, { onConflict: 'api_fixture_id' });

        if (fixtureError) {
          fixturesFailed++;
          console.error(`❌ Fixture upsert FAILED for API ID ${fixture.id}:`);
          console.error(`   Error: ${fixtureError.message}`);
          console.error(`   Error code: ${fixtureError.code}`);
          console.error(`   Error details: ${fixtureError.details}`);
          throw new Error(`Fixture upsert failed for API ID ${fixture.id}: ${fixtureError.message}`);
        } else {
          fixturesSuccessful++;
          console.log(`✅ Fixture upserted successfully: ${teams.home.name} vs ${teams.away.name}`);
        }

      } catch (innerError: unknown) {
        fixturesFailed++;
        console.error(`❌ Failed processing fixture API ID ${item.fixture?.id}: ${innerError instanceof Error ? innerError.message : innerError}`);
      }
    } // End loop through fixtures
    
    console.log(`\n📊 FIXTURES PROCESSING SUMMARY:`);
    console.log(`   Total processed: ${fixturesProcessed}`);
    console.log(`   Successful: ${fixturesSuccessful}`);
    console.log(`   Failed: ${fixturesFailed}`);
    console.log(`   Skipped: ${fixturesSkipped}`);

    console.log(`\n🎉 POPULATION COMPLETE FOR LEAGUE ${leagueId}, SEASON ${seasonYear}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Teams: ${teamsSuccessful} successful, ${teamsFailed} failed`);
    console.log(`✅ Fixtures: ${fixturesSuccessful} successful, ${fixturesFailed} failed, ${fixturesSkipped} skipped`);
    console.log(`✅ Team mappings created: ${upsertedTeamIds.size}`);
    console.log(`✅ Round mappings created: ${upsertedRoundIds.size}`);

  } catch (error: unknown) {
    console.error(`\n❌ FATAL ERROR in populateFixturesForSeason for league ${leagueId}, season ${seasonYear}:`);
    console.error(`   ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace: ${error.stack}`);
    }
    throw error; // Re-throw to ensure caller knows about the failure
  }
}

// Example Usage (adjust as needed)
// async function runPopulation() {
//   await populateFixturesForSeason(39, 2024);
// }
// runPopulation(); 