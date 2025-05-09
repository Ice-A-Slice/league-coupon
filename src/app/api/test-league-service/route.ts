import { NextResponse } from 'next/server';
import { 
  LeagueDataServiceImpl, 
  type LeagueTable, 
  type PlayerStatistic, 
  type TeamStanding 
} from '@/lib/leagueDataService'; // Adjust path if necessary

// Define an interface for the response structure
interface TestServiceResponse {
  leagueTable?: LeagueTable | null;
  leagueTableError?: string;
  topScorers?: PlayerStatistic[] | null;
  topScorersError?: string;
  teamWithBestGoalDifference?: TeamStanding | null;
  teamWithBestGoalDifferenceError?: string;
  lastPlaceTeam?: TeamStanding | null;
  lastPlaceTeamError?: string;
}

export async function GET() {
  // Ensure the API key is available in the environment where this serverless function runs
  if (!process.env.NEXT_PUBLIC_FOOTBALL_API_KEY) {
    console.error('Test API Route: NEXT_PUBLIC_FOOTBALL_API_KEY is not set.');
    return NextResponse.json(
      { error: 'Server configuration error: Missing API key for football data.' },
      { status: 500 }
    );
  }

  const leagueService = new LeagueDataServiceImpl();
  
  const competitionApiId = 39;
  const seasonYear = 2024; 

  try {
    console.log(`Test API Route: Fetching data for league ${competitionApiId}, season ${seasonYear}`);
    
    // Initialize response data object with the specific type
    const responseData: TestServiceResponse = {};
    let hasCriticalError = false; // To track if any primary data fetching failed critically

    // Fetch all data concurrently for efficiency
    const [leagueTable, topScorers, teamWithBestGD, lastPlaceTeam] = await Promise.all([
      leagueService.getCurrentLeagueTable(competitionApiId, seasonYear),
      leagueService.getCurrentTopScorers(competitionApiId, seasonYear),
      leagueService.getTeamWithBestGoalDifference(competitionApiId, seasonYear),
      leagueService.getLastPlaceTeam(competitionApiId, seasonYear)
    ]);

    if (leagueTable) {
      console.log('Test API Route: Successfully fetched league table.');
      responseData.leagueTable = leagueTable;
    } else {
      console.log('Test API Route: Failed to fetch league table (service returned null).');
      responseData.leagueTableError = 'Failed to retrieve league table data from the service.';
      hasCriticalError = true; // League table is crucial for other derived data
    }

    if (topScorers) {
      console.log('Test API Route: Successfully fetched top scorers.');
      responseData.topScorers = topScorers;
    } else {
      console.log('Test API Route: Failed to fetch top scorers (service returned null or error occurred).');
      responseData.topScorersError = 'Failed to retrieve top scorers data from the service.';
      // Not necessarily critical if leagueTable is okay, but good to note.
    }

    if (teamWithBestGD) {
      console.log('Test API Route: Successfully fetched team with best goal difference.');
      responseData.teamWithBestGoalDifference = teamWithBestGD;
    } else {
      console.log('Test API Route: Failed to fetch team with best goal difference.');
      responseData.teamWithBestGoalDifferenceError = leagueTable ? 'Could not determine team with best GD from available data.' : 'Dependency error: League table not available.';
    }

    if (lastPlaceTeam) {
      console.log('Test API Route: Successfully fetched last place team.');
      responseData.lastPlaceTeam = lastPlaceTeam;
    } else {
      console.log('Test API Route: Failed to fetch last place team.');
      responseData.lastPlaceTeamError = leagueTable ? 'Could not determine last place team from available data.' : 'Dependency error: League table not available.';
    }

    if (hasCriticalError && !leagueTable) {
        return NextResponse.json(
            { error: 'Critical error: Failed to retrieve league table data.', details: responseData },
            { status: 500 }
        );
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Test API Route: Unexpected error calling LeagueDataService:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching league data.' },
      { status: 500 }
    );
  }
} 