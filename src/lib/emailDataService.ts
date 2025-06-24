import { fetchComprehensiveMatchData } from '@/services/football-api/client';
import { generateMatchStory, generateLeagueStories, type MatchStory, type LeagueStories } from '@/lib/storyGenerationService';
import { getFixturesForRound, getCurrentBettingRoundFixtures } from '@/lib/supabase/queries';

// Types for email data
export interface EmailMatchResult {
  id: number;
  homeTeam: {
    name: string;
    score: number;
  };
  awayTeam: {
    name: string;
    score: number;
  };
  kickoff: string;
  story?: MatchStory;
}

export interface EmailUserPerformance {
  userId: string;
  userName: string;
  position: number;
  positionChange: number; // Positive = moved up, negative = moved down
  pointsEarned: number;
  correctPredictions: number;
  totalPredictions: number;
  currentStreak: number;
  weeklyRank: number;
  monthlyRank: number;
}

export interface EmailLeagueTable {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDifference: number;
  form: string; // e.g., "WWDLW"
}

export interface SummaryEmailData {
  roundNumber: number;
  roundName: string;
  user: EmailUserPerformance;
  matchResults: EmailMatchResult[];
  leagueTable: EmailLeagueTable[];
  aiStories: LeagueStories;
  weekHighlights: {
    goalOfTheWeek?: string;
    performanceOfTheWeek?: string;
    upsetOfTheWeek?: string;
  };
}

export interface ReminderEmailData {
  roundNumber: number;
  roundName: string;
  user: {
    name: string;
    position: number;
    form: string;
    recentPerformance: string;
  };
  deadline: {
    roundNumber: number;
    timeRemaining: string;
    isUrgent: boolean;
    hoursRemaining: number;
  };
  upcomingFixtures: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    kickoff: string;
    importance: 'high' | 'medium' | 'low';
    difficulty: 'hard' | 'medium' | 'easy';
  }[];
  keyMatches: {
    homeTeam: string;
    awayTeam: string;
    reason: string; // Why this match is key
  }[];
  aiInsights: {
    personalStrategy: string;
    formAnalysis: string;
    predictions: string;
  };
}

/**
 * Fetches completed match results for a specific round with generated stories
 */
export async function getCompletedMatchResults(
  roundName: string,
  seasonYear: number,
  leagueApiId: number
): Promise<EmailMatchResult[]> {
  try {
    console.log(`Fetching completed match results for round: ${roundName}`);
    
    // Get basic fixture data from database
    const fixtures = await getFixturesForRound(roundName, seasonYear, leagueApiId);
    if (!fixtures || fixtures.length === 0) {
      console.log('No fixtures found for the specified round');
      return [];
    }

    // Fetch comprehensive data for each completed fixture
    const matchResults: EmailMatchResult[] = [];
    
    for (const fixture of fixtures) {
      try {
        // In a real implementation, you'd check if the match is completed
        // For now, we'll assume all fetched fixtures are completed
        const comprehensiveData = await fetchComprehensiveMatchData(Number(fixture.id));
        
        if (comprehensiveData && comprehensiveData.fixture.response.length > 0) {
          const fixtureData = comprehensiveData.fixture.response[0];
          const events = comprehensiveData.events.response;
          const playerStats = comprehensiveData.playerStats.response.flatMap(team => team.players);

          // Generate story for this match
          const story = generateMatchStory(fixtureData, events, playerStats);

          matchResults.push({
            id: Number(fixture.id),
            homeTeam: {
              name: fixtureData.teams.home.name,
              score: fixtureData.goals.home || 0,
            },
            awayTeam: {
              name: fixtureData.teams.away.name,
              score: fixtureData.goals.away || 0,
            },
            kickoff: fixtureData.fixture.date,
            story,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch comprehensive data for fixture ${fixture.id}:`, error);
        // Add basic match result without story
        matchResults.push({
          id: Number(fixture.id),
          homeTeam: {
            name: fixture.homeTeam,
            score: 0, // Would need to fetch from API or database
          },
          awayTeam: {
            name: fixture.awayTeam,
            score: 0, // Would need to fetch from API or database
          },
          kickoff: new Date().toISOString(), // Would need actual kickoff time
        });
      }
    }

    console.log(`Successfully fetched ${matchResults.length} match results with stories`);
    return matchResults;

  } catch (error) {
    console.error('Error fetching completed match results:', error);
    throw error; // Re-throw to allow aggregateSummaryEmailData to handle it
  }
}

/**
 * Fetches upcoming fixtures for reminder emails
 */
export async function getUpcomingFixtures(): Promise<ReminderEmailData['upcomingFixtures']> {
  try {
    console.log('Fetching upcoming fixtures for reminder email');
    
    const currentRoundData = await getCurrentBettingRoundFixtures();
    if (!currentRoundData) {
      console.log('No current round fixtures found');
      return [];
    }

    // Transform Match[] to reminder email format
    const upcomingFixtures = currentRoundData.matches.map(match => ({
      id: Number(match.id),
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoff: new Date().toISOString(), // Would need actual kickoff time from database
      importance: 'medium' as const, // Would calculate based on league positions
      difficulty: 'medium' as const, // Would calculate based on team form
    }));

    console.log(`Found ${upcomingFixtures.length} upcoming fixtures`);
    return upcomingFixtures;

  } catch (error) {
    console.error('Error fetching upcoming fixtures:', error);
    return [];
  }
}

/**
 * Generates mock user performance data (would be replaced with real database queries)
 */
export function getMockUserPerformance(userId: string): EmailUserPerformance {
  // This would be replaced with actual database queries
  return {
    userId,
    userName: 'John Doe',
    position: 5,
    positionChange: 2, // Moved up 2 positions
    pointsEarned: 12,
    correctPredictions: 7,
    totalPredictions: 10,
    currentStreak: 3,
    weeklyRank: 3,
    monthlyRank: 7,
  };
}

/**
 * Generates mock league table data (would be replaced with real API calls)
 */
export function getMockLeagueTable(): EmailLeagueTable[] {
  // This would be replaced with actual API calls to get league standings
  return [
    { position: 1, team: 'Arsenal', played: 20, won: 15, drawn: 3, lost: 2, points: 48, goalDifference: 25, form: 'WWWDW' },
    { position: 2, team: 'Liverpool', played: 20, won: 14, drawn: 4, lost: 2, points: 46, goalDifference: 22, form: 'WDWWW' },
    { position: 3, team: 'Manchester City', played: 19, won: 13, drawn: 4, lost: 2, points: 43, goalDifference: 28, form: 'DWWWL' },
    { position: 4, team: 'Aston Villa', played: 20, won: 12, drawn: 4, lost: 4, points: 40, goalDifference: 15, form: 'WLWWW' },
    { position: 5, team: 'Tottenham', played: 20, won: 11, drawn: 3, lost: 6, points: 36, goalDifference: 8, form: 'LWWDL' },
    { position: 6, team: 'Newcastle', played: 20, won: 10, drawn: 4, lost: 6, points: 34, goalDifference: 12, form: 'WDLWW' },
  ];
}

/**
 * Aggregates all data needed for summary emails
 */
export async function aggregateSummaryEmailData(
  userId: string,
  roundName: string,
  seasonYear: number,
  leagueApiId: number
): Promise<SummaryEmailData> {
  console.log(`Aggregating summary email data for user ${userId}, round ${roundName}`);

  try {
    // Fetch all required data in parallel
    const [matchResults, userPerformance, leagueTable] = await Promise.all([
      getCompletedMatchResults(roundName, seasonYear, leagueApiId),
      Promise.resolve(getMockUserPerformance(userId)), // Would be async database call
      Promise.resolve(getMockLeagueTable()), // Would be async API call
    ]);

    // Generate AI stories from match results
    const matchStories = matchResults.map(match => match.story).filter(Boolean) as MatchStory[];
    const aiStories = generateLeagueStories(matchStories, roundName);

    // Extract round number from round name (e.g., "Regular Season - 15" -> 15, "Gameweek 20" -> 20)
    const roundNumber = parseInt(
      roundName.includes(' - ')
        ? roundName.split(' - ')[1]
        : roundName.replace(/\D/g, '') || '1'
    );

    const summaryData: SummaryEmailData = {
      roundNumber,
      roundName,
      user: userPerformance,
      matchResults,
      leagueTable,
      aiStories,
      weekHighlights: aiStories.weekHighlights,
    };

    console.log('Successfully aggregated summary email data');
    return summaryData;

  } catch (error) {
    console.error('Error aggregating summary email data:', error);
    throw error;
  }
}

/**
 * Aggregates all data needed for reminder emails
 */
export async function aggregateReminderEmailData(
  userId: string,
  deadlineHours: number = 24
): Promise<ReminderEmailData> {
  console.log(`Aggregating reminder email data for user ${userId}`);

  try {
    // Fetch upcoming fixtures
    const upcomingFixtures = await getUpcomingFixtures();
    
    // Check if we have current round data
    if (upcomingFixtures.length === 0) {
      const currentRoundData = await getCurrentBettingRoundFixtures();
      if (!currentRoundData) {
        throw new Error('No current betting round found');
      }
    }
    
    // Calculate deadline information
    const isUrgent = deadlineHours <= 6;
    const timeRemaining = deadlineHours > 24
      ? `${Math.floor(deadlineHours / 24)} days`
      : `${deadlineHours} hours`;

    // Identify key matches (would use more sophisticated logic in real implementation)
    const keyMatches = upcomingFixtures.slice(0, 3).map(fixture => ({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      reason: 'Top 6 clash with title implications',
    }));

    // Generate AI insights (would use actual AI service in real implementation)
    const aiInsights = {
      personalStrategy: 'Focus on home teams this week - they\'ve been strong at home recently.',
      formAnalysis: 'Your recent predictions have been strong on defensive games. Consider the under on total goals.',
      predictions: 'Arsenal and Liverpool look like safe bets this round based on current form.',
    };

    const reminderData: ReminderEmailData = {
      roundNumber: 1, // Would extract from current round
      roundName: 'Regular Season - 1', // Would get from current round
      user: {
        name: 'John Doe', // Would fetch from user database
        position: 5,
        form: 'WWLWW',
        recentPerformance: 'Strong recent form with 4 wins in last 5 rounds',
      },
      deadline: {
        roundNumber: 1,
        timeRemaining,
        isUrgent,
        hoursRemaining: deadlineHours,
      },
      upcomingFixtures,
      keyMatches,
      aiInsights,
    };

    console.log('Successfully aggregated reminder email data');
    return reminderData;

  } catch (error) {
    console.error('Error aggregating reminder email data:', error);
    throw error;
  }
}

/**
 * Helper function to determine if a round is completed
 * (would check fixture status in real implementation)
 */
export function isRoundCompleted(_roundName: string): boolean {
  // This would check the actual fixture statuses from the database/API
  // For now, return true for demonstration
  return true;
}

/**
 * Helper function to get the current active round for predictions
 */
export async function getCurrentActiveRound(): Promise<{ roundName: string; roundNumber: number } | null> {
  try {
    const currentRoundData = await getCurrentBettingRoundFixtures();
    if (!currentRoundData) {
      return null;
    }

    // Extract round number from round name
    const roundNumber = parseInt(currentRoundData.roundName.split(' - ')[1] || '1');

    return {
      roundName: currentRoundData.roundName,
      roundNumber,
    };
  } catch (error) {
    console.error('Error getting current active round:', error);
    return null;
  }
} 