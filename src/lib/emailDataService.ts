import { fetchComprehensiveMatchData } from '@/services/football-api/client';
// Removed - using new AI service integration
import { getFixturesForRound, getCurrentBettingRoundFixtures } from '@/lib/supabase/queries';
import { 
  type SummaryEmailData as FetchedSummaryEmailData, 
  type UserRoundPredictions, 
  type SummaryMatchResult,
  EmailDataFetchingService 
} from '@/lib/emailDataFetchingService';
import { type UserStandingEntry } from '@/services/standingsService';
import { 
  type SummaryEmailProps, 
  type MatchResult, 
  type UserPerformance, 
  type LeagueStanding, 
  type AIGeneratedStory,
  type CupData
} from '@/components/emails/SummaryEmail';
import { logger } from '@/utils/logger';

// Import our new AI services
import { storyGenerationService } from '@/lib/storyGenerationService';
import { promptTemplateService } from '@/lib/promptTemplateService';

// Import cup-related services for season finale detection
import { cupActivationStatusChecker, type CupActivationStatus } from '@/services/cup/cupActivationStatusChecker';
import { CupWinnerDeterminationService } from '@/services/cup/cupWinnerDeterminationService';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';

// Re-export types for external use
export type { SummaryEmailProps };

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
  // story?: MatchStory; // Removed - now handled by AI service
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
  aiStories: {
    titleRace: string;
    matchHighlights: string[];
    weekHighlights: {
      goalOfTheWeek?: string;
      performanceOfTheWeek?: string;
      upsetOfTheWeek?: string;
    };
  };
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
          // Note: events and playerStats would be used for AI story generation
          // const events = comprehensiveData.events.response;
          // const playerStats = comprehensiveData.playerStats;

          // Note: Story generation now handled by AI services in generateAIStories

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

    // Note: AI stories now generated through new AI services (generateAIStories method)
    const aiStories = {
      titleRace: 'Generated by AI services',
      matchHighlights: [],
      weekHighlights: {
        goalOfTheWeek: 'Generated by AI services',
        performanceOfTheWeek: 'Generated by AI services',
        upsetOfTheWeek: 'Generated by AI services'
      }
    };

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

/**
 * Service that transforms data from EmailDataFetchingService into the format
 * expected by the SummaryEmail template component.
 */
export class EmailDataService {
  private emailDataFetcher: EmailDataFetchingService;

  constructor() {
    this.emailDataFetcher = new EmailDataFetchingService();
  }

  /**
   * Check if this is a season finale email by examining if no roundId is provided
   * or if the season is marked as completed
   */
  private async isSeasonFinaleEmail(roundId?: number): Promise<boolean> {
    // If no roundId provided, this is likely a season summary email
    if (!roundId) {
      return true;
    }

    // Check if the season containing this round is completed
    try {
      const supabase = createSupabaseServiceRoleClient();
      const { data: roundLink } = await supabase
        .from('betting_round_fixtures')
        .select(`
          fixtures (
            rounds (
              seasons (
                completed_at
              )
            )
          )
        `)
        .eq('betting_round_id', roundId)
        .limit(1)
        .single();

      return !!roundLink?.fixtures?.rounds?.seasons?.completed_at;
    } catch (error) {
      logger.warn('EmailDataService: Failed to check season completion status', { roundId, error });
      return false;
    }
  }

  /**
   * Get cup data for season finale emails
   */
  private async getCupDataForSeason(seasonId?: number): Promise<CupData | null> {
    try {
      let cupStatus: CupActivationStatus;
      
      if (seasonId) {
        // Check specific season
        cupStatus = await cupActivationStatusChecker.checkSeasonActivationStatus(seasonId);
      } else {
        // Check current season
        cupStatus = await cupActivationStatusChecker.checkCurrentSeasonActivationStatus();
      }

      const cupData: CupData = {
        isActive: cupStatus.isActivated,
        seasonId: cupStatus.seasonId,
        seasonName: cupStatus.seasonName,
        activatedAt: cupStatus.activatedAt
      };

      // If cup was not activated, return basic cup data
      if (!cupStatus.isActivated || !cupStatus.seasonId) {
        return cupData;
      }

      // Get cup standings and winners for activated cups
      const cupService = new CupWinnerDeterminationService(createSupabaseServiceRoleClient());
      
      // Get cup standings
      const standingsResult = await cupService.calculateCupStandings(cupStatus.seasonId);
      cupData.standings = standingsResult.standings.map(entry => ({
        user_id: entry.user_id,
        username: entry.username || 'Unknown User',
        total_points: entry.total_points,
        rounds_participated: entry.rounds_participated,
        rank: entry.rank,
        is_tied: entry.is_tied
      }));
      cupData.totalParticipants = standingsResult.standings.length;

      // Check if season is completed and get winners
      const supabase = createSupabaseServiceRoleClient();
      const { data: season } = await supabase
        .from('seasons')
        .select('completed_at')
        .eq('id', cupStatus.seasonId)
        .single();

      if (season?.completed_at) {
        // Get cup winners from season_winners table
        const { data: winners } = await supabase
          .from('season_winners')
          .select(`
            user_id,
            total_points
          `)
          .eq('season_id', cupStatus.seasonId)
          .eq('competition_type', 'last_round_special')
          .order('total_points', { ascending: false });

        if (winners && winners.length > 0) {
          // Add user info with fallback logic
          const winnersWithNames = await Promise.all(
            winners.map(async (winner, index) => {
              // Get user display name with fallback
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', winner.user_id)
                .single();
              
              let displayName = profile?.full_name;
              
              if (!displayName) {
                // Fallback to auth metadata
                const { data: authUser } = await supabase.auth.admin.getUserById(winner.user_id);
                if (authUser?.user?.user_metadata) {
                  const metadata = authUser.user.user_metadata;
                  displayName = metadata.full_name || metadata.name || metadata.display_name;
                }
                
                if (!displayName && authUser?.user?.email) {
                  const emailPrefix = authUser.user.email.split('@')[0];
                  displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
                }
                
                displayName = displayName || `User ${winner.user_id.slice(-8)}`;
              }
              
              return {
                user_id: winner.user_id,
                username: displayName,
                total_points: winner.total_points || 0,
                rank: index + 1, // Calculate rank based on order
                is_tied: false // TODO: Could enhance this with tie detection
              };
            })
          );
          
          cupData.winners = winnersWithNames;
        }
      }

      logger.info('EmailDataService: Successfully aggregated cup data', {
        seasonId: cupStatus.seasonId,
        isActive: cupData.isActive,
        participantsCount: cupData.totalParticipants,
        winnersCount: cupData.winners?.length || 0
      });

      return cupData;

    } catch (error) {
      logger.error('EmailDataService: Failed to get cup data for season', {
        seasonId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get complete SummaryEmail props for a specific user and round
   */
  async getSummaryEmailProps(
    userId: string,
    roundId?: number
  ): Promise<SummaryEmailProps> {
    try {
      logger.info('EmailDataService: Fetching summary email data', { userId, roundId });
      
      // Check if this is a season finale email
      const isSeasonFinale = await this.isSeasonFinaleEmail(roundId);
      
      // Fetch raw data from EmailDataFetchingService
      const summaryData = await this.emailDataFetcher.getSummaryEmailData(roundId);
      if (!summaryData) {
        throw new Error(`Summary data not found for roundId: ${roundId}`);
      }
      
      // Find user-specific data
      const userPredictions = summaryData.userPredictions.find(up => up.userId === userId);
      if (!userPredictions) {
        throw new Error(`User predictions not found for userId: ${userId}`);
      }

      // Get season ID for cup data (if season finale)
      let seasonId: number | undefined;
      if (isSeasonFinale && roundId) {
        try {
          const supabase = createSupabaseServiceRoleClient();
          const { data: roundLink } = await supabase
            .from('betting_round_fixtures')
            .select(`
              fixtures (
                rounds (
                  season_id
                )
              )
            `)
            .eq('betting_round_id', roundId)
            .limit(1)
            .single();
          seasonId = roundLink?.fixtures?.rounds?.season_id;
        } catch (error) {
          logger.warn('EmailDataService: Failed to get season ID for round', { roundId, error });
        }
      }

      // Get cup data for season finales
      let cupData: CupData | undefined;
      if (isSeasonFinale) {
        cupData = await this.getCupDataForSeason(seasonId) || undefined;
      }

      // Transform data to SummaryEmail format
      const props: SummaryEmailProps = {
        user: this.transformUserPerformance(userPredictions, summaryData),
        roundNumber: summaryData.round.roundId,
        matches: this.transformMatches(summaryData.round.matches),
        leagueStandings: this.transformLeagueStandings(summaryData.standings),
        aiStories: await this.generateAIStories(summaryData, cupData), // Enhanced with cup data for season finales
        weekHighlights: this.generateWeekHighlights(summaryData),
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        // Cup data for season finales
        cupData,
        isSeasonFinale
      };

      logger.info('EmailDataService: Successfully transformed summary email data', { 
        userId, 
        roundId: summaryData.round.roundId,
        matchCount: props.matches.length,
        standingsCount: props.leagueStandings.length,
        isSeasonFinale,
        hasCupData: !!cupData,
        cupIsActive: cupData?.isActive || false
      });

      return props;
    } catch (error) {
      logger.error('EmailDataService: Failed to get summary email props', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        roundId 
      });
      throw error;
    }
  }

  /**
   * Transform user predictions data into UserPerformance format
   */
  private transformUserPerformance(
    userPredictions: UserRoundPredictions,
    summaryData: FetchedSummaryEmailData
  ): UserPerformance {
    // Find user's current position in standings
    const userStanding = summaryData.standings.find(s => s.user_id === userPredictions.userId);
    
    return {
      name: userPredictions.userName || 'Unknown User',
      currentPosition: userStanding?.rank || 0,
      previousPosition: undefined, // This property is not available in UserStandingEntry
      pointsEarned: userPredictions.pointsEarned,
      totalPoints: userStanding?.combined_total_score || 0,
      correctPredictions: userPredictions.correctPredictions,
      totalPredictions: userPredictions.totalPredictions,
      bestPrediction: this.findBestPrediction(userPredictions, summaryData.round.matches)
    };
  }

  /**
   * Transform match data into MatchResult format
   */
  private transformMatches(matches: SummaryMatchResult[]): MatchResult[] {
    return matches.map(match => ({
      id: match.id,
      homeTeam: {
        name: match.homeTeam.name,
        score: match.homeTeam.score || 0
      },
      awayTeam: {
        name: match.awayTeam.name,
        score: match.awayTeam.score || 0
      },
      status: match.status,
      dramatic: this.isDramaticMatch(match) // Simple heuristic for now
    }));
  }

  /**
   * Transform standings data into LeagueStanding format
   */
  private transformLeagueStandings(standings: UserStandingEntry[]): LeagueStanding[] {
    return standings.map(standing => ({
      position: standing.rank,
      teamName: standing.username || 'Unknown User', // In our context, "teams" are users
      points: standing.combined_total_score,
      played: 0, // Not available in UserStandingEntry
      won: 0, // Not available in UserStandingEntry
      drawn: 0, // Not applicable for prediction league
      lost: 0, // Not available in UserStandingEntry
      goalDifference: 0 // Not applicable for prediction league
    }));
  }

  /**
   * Generate AI-powered stories using our new AI content generation services
   */
  private async generateAIStories(summaryData: FetchedSummaryEmailData, cupData?: CupData): Promise<AIGeneratedStory[]> {
    const stories: AIGeneratedStory[] = [];
    
    try {
      // 1. Title race story if we have standings
      if (summaryData.standings.length > 0) {
        const titleRaceStory = await this.generateTitleRaceStory(summaryData);
        if (titleRaceStory) stories.push(titleRaceStory);
      }

      // 2. Dramatic match story
      const dramaticMatch = this.findMostDramaticMatch(summaryData.round.matches);
      if (dramaticMatch) {
        const matchStory = await this.generateMatchStory(dramaticMatch, summaryData.round.roundId);
        if (matchStory) stories.push(matchStory);
      }

      // 3. Round analysis story
      const roundStory = await this.generateRoundAnalysisStory(summaryData);
      if (roundStory) stories.push(roundStory);

      // 4. Cup story if it's a season finale and we have cup data
      if (cupData?.isActive && cupData.winners && cupData.winners.length > 0) {
        const cupStory = await this.generateCupStory(cupData);
        if (cupStory) stories.push(cupStory);
      }

      // Limit to 3 stories maximum
      return stories.slice(0, 3);
    } catch (error) {
      logger.error('EmailDataService: Failed to generate AI stories, using fallback', { error });
      return this.generateFallbackStories(summaryData);
    }
  }

  /**
   * Generate title race story using AI
   */
  private async generateTitleRaceStory(summaryData: FetchedSummaryEmailData): Promise<AIGeneratedStory | null> {
    if (summaryData.standings.length < 2) return null;

    const topThree = summaryData.standings.slice(0, 3);
    const leader = topThree[0];

    const prompt = promptTemplateService.generateStoryPrompt('title_race', {
      roundNumber: summaryData.round.roundId,
      username: leader.username || 'Unknown',
      totalPoints: leader.combined_total_score,
      rank: 1,
      totalParticipants: summaryData.standings.length
    });

    const content = await storyGenerationService.generateStory(prompt, 'title_race');
    if (!content) return null;

    return {
      headline: `${leader.username || 'Unknown'} Leads After Round ${summaryData.round.roundId}`,
      content,
      type: 'title_race'
    };
  }

  /**
   * Generate dramatic match story using AI
   */
  private async generateMatchStory(match: SummaryMatchResult, roundNumber: number): Promise<AIGeneratedStory | null> {
    const prompt = promptTemplateService.generateStoryPrompt('match_drama', {
      roundNumber,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore: match.homeTeam.score || 0,
      awayScore: match.awayTeam.score || 0,
      matchType: 'completed'
    });

    const content = await storyGenerationService.generateStory(prompt, 'match_drama');
    if (!content) return null;

    const homeScore = match.homeTeam.score || 0;
    const awayScore = match.awayTeam.score || 0;
    const winner = homeScore > awayScore ? match.homeTeam.name : 
                   awayScore > homeScore ? match.awayTeam.name : null;

    return {
      headline: winner ? `${winner} Triumphs in ${match.homeTeam.name} vs ${match.awayTeam.name}` : 
                        `${match.homeTeam.name} and ${match.awayTeam.name} Share the Points`,
      content,
      type: 'drama'
    };
  }

  /**
   * Generate round analysis story using AI
   */
  private async generateRoundAnalysisStory(summaryData: FetchedSummaryEmailData): Promise<AIGeneratedStory | null> {
    const completedMatches = summaryData.round.matches.filter(m => m.status === 'FT');
    if (completedMatches.length === 0) return null;

    const prompt = promptTemplateService.generateStoryPrompt('form', {
      roundNumber: summaryData.round.roundId
    });

    const content = await storyGenerationService.generateStory(prompt, 'form');
    if (!content) return null;

    return {
      headline: `Round ${summaryData.round.roundId} Analysis`,
      content,
      type: 'form'
    };
  }

  /**
   * Generate cup story for season finale emails
   */
  private async generateCupStory(cupData: CupData): Promise<AIGeneratedStory | null> {
    if (!cupData.isActive || !cupData.winners || cupData.winners.length === 0) {
      return null;
    }

    try {
      const winner = cupData.winners[0]; // Primary winner
      const totalParticipants = cupData.totalParticipants || 0;
      const isMultipleWinners = cupData.winners.length > 1;

      // Determine story type and content based on cup outcome
      let headline: string;
      let content: string;

      if (isMultipleWinners) {
        // Multiple winners (tie scenario)
        const winnerNames = cupData.winners.map(w => w.username).join(', ');
        headline = `🏆 Last Round Special: ${cupData.winners.length}-Way Tie for the Crown!`;
        content = `The Last Round Special cup concludes with a thrilling ${cupData.winners.length}-way tie! ${winnerNames} all finished with ${winner.total_points} points each, sharing the cup victory. Out of ${totalParticipants} participants, these champions rose above the rest when it mattered most. What a spectacular finish to the competition!`;
      } else {
        // Single winner
        headline = `🏆 Last Round Special Champion: ${winner.username} Takes the Crown!`;
        content = `${winner.username} has emerged victorious in the Last Round Special cup! With ${winner.total_points} points, they outpredicted ${totalParticipants - 1} other participants in this exclusive competition. The cup was activated when 60% of teams had 5 or fewer games remaining, and ${winner.username} proved they could handle the pressure when it counted most.`;
      }

      // Use AI to enhance the story if possible
      try {
        const prompt = `Create an engaging story about the Last Round Special cup winner(s): ${cupData.winners.map(w => w.username).join(', ')} with ${winner.total_points} points. There were ${totalParticipants} total participants. Make it exciting and congratulatory. Keep it under 100 words.`;
        
        const aiStory = await storyGenerationService.generateStory(prompt, 'cup_winner');

        if (aiStory && aiStory.length > 50) {
          content = aiStory;
        }
      } catch (aiError) {
        logger.warn('EmailDataService: AI cup story generation failed, using fallback', { aiError });
        // Keep the fallback content created above
      }

      return {
        headline,
        content,
        type: 'title_race' // Cup winners are title race type stories
      };

    } catch (error) {
      logger.error('EmailDataService: Failed to generate cup story', { error });
      return null;
    }
  }

  /**
   * Find the most dramatic match for story generation
   */
  private findMostDramaticMatch(matches: SummaryMatchResult[]): SummaryMatchResult | null {
    const dramaticMatches = matches.filter(m => this.isDramaticMatch(m));
    if (dramaticMatches.length === 0) return matches[0] || null;

    // Sort by drama score (high scores, close games, etc.)
    return dramaticMatches.sort((a, b) => {
      const aScore = (a.homeTeam.score || 0) + (a.awayTeam.score || 0);
      const bScore = (b.homeTeam.score || 0) + (b.awayTeam.score || 0);
      return bScore - aScore; // Prefer high-scoring games
    })[0];
  }

  /**
   * Fallback stories when AI generation fails
   */
  private generateFallbackStories(summaryData: FetchedSummaryEmailData): AIGeneratedStory[] {
    const stories: AIGeneratedStory[] = [];
    
    // Round completion story
    stories.push({
      headline: `Round ${summaryData.round.roundId} Completed`,
      content: `All ${summaryData.round.matches.length} matches in Round ${summaryData.round.roundId} have concluded. Check out the results and see how your predictions performed!`,
      type: 'performance'
    });

    // Top performer story if we have standings
    if (summaryData.standings.length > 0) {
      const topPerformer = summaryData.standings[0];
      stories.push({
        headline: `${topPerformer.username || 'Unknown User'} Leads the Pack`,
        content: `${topPerformer.username || 'Unknown User'} continues to dominate with ${topPerformer.combined_total_score} total points. Can anyone catch up?`,
        type: 'title_race'
      });
    }

    return stories;
  }

  /**
   * Generate week highlights from summary data
   */
  private generateWeekHighlights(summaryData: FetchedSummaryEmailData) {
    if (summaryData.standings.length === 0) return undefined;

    // Find top performer of the round
    const topRoundPerformer = summaryData.userPredictions
      .sort((a, b) => b.pointsEarned - a.pointsEarned)[0];

    // Find biggest upset (highest scoring match)
    const biggestUpset = summaryData.round.matches
      .sort((a, b) => ((b.homeTeam.score || 0) + (b.awayTeam.score || 0)) - ((a.homeTeam.score || 0) + (a.awayTeam.score || 0)))[0];

    return {
      topPerformer: topRoundPerformer?.userName || 'Unknown',
      biggestUpset: biggestUpset ? 
        `${biggestUpset.homeTeam.name} ${biggestUpset.homeTeam.score}-${biggestUpset.awayTeam.score} ${biggestUpset.awayTeam.name}` : 
        'No upsets this round'
    };
  }

  /**
   * Find user's best prediction for this round
   */
  private findBestPrediction(userPredictions: UserRoundPredictions, matches: SummaryMatchResult[]): string | undefined {
    // Simple heuristic: find a correct prediction for a dramatic match
    // TODO: Enhance this logic in future iterations
    
    const correctPredictions = userPredictions.predictions?.filter(p => p.isCorrect) || [];
    if (correctPredictions.length === 0) return undefined;

    // Find if any correct prediction was for a dramatic match
    const dramaticCorrectPrediction = correctPredictions.find(p => {
      const match = matches.find(m => m.id === p.matchId);
      return match && this.isDramaticMatch(match);
    });

    if (dramaticCorrectPrediction) {
      const match = matches.find(m => m.id === dramaticCorrectPrediction.matchId);
      if (match) {
        return `${match.homeTeam.name} ${match.homeTeam.score}-${match.awayTeam.score} ${match.awayTeam.name}`;
      }
    }

    // Otherwise, just return the first correct prediction
    const firstCorrect = correctPredictions[0];
    const match = matches.find(m => m.id === firstCorrect.matchId);
    if (match) {
      return `${match.homeTeam.name} ${match.homeTeam.score}-${match.awayTeam.score} ${match.awayTeam.name}`;
    }

    return undefined;
  }

  /**
   * Simple heuristic to determine if a match was dramatic
   */
  private isDramaticMatch(match: SummaryMatchResult): boolean {
    if (!match.homeTeam.score || !match.awayTeam.score) return false;
    
    const totalGoals = match.homeTeam.score + match.awayTeam.score;
    const goalDifference = Math.abs(match.homeTeam.score - match.awayTeam.score);
    
    // High-scoring match (4+ goals) OR close match (1 goal difference) with decent scoring
    return totalGoals >= 4 || (goalDifference <= 1 && totalGoals >= 2);
  }

  /**
   * Get summary email props for multiple users (for batch sending)
   */
  async getBatchSummaryEmailProps(
    userIds: string[],
    roundId?: number
  ): Promise<Map<string, SummaryEmailProps>> {
    const results = new Map<string, SummaryEmailProps>();
    
    // Fetch data once and reuse for all users
    const summaryData = await this.emailDataFetcher.getSummaryEmailData(roundId);
    if (!summaryData) {
      logger.error('EmailDataService: Summary data not found for batch processing', { roundId });
      return results;
    }
    
    // Generate AI stories once for efficiency (shared across all users)
    const aiStories = await this.generateAIStories(summaryData);
    
    for (const userId of userIds) {
      try {
        const userPredictions = summaryData.userPredictions.find(up => up.userId === userId);
        if (!userPredictions) {
          logger.warn('EmailDataService: User predictions not found', { userId });
          continue;
        }

        const props: SummaryEmailProps = {
          user: this.transformUserPerformance(userPredictions, summaryData),
          roundNumber: summaryData.round.roundId,
          matches: this.transformMatches(summaryData.round.matches),
          leagueStandings: this.transformLeagueStandings(summaryData.standings),
          aiStories, // Use the shared AI stories for all users
          weekHighlights: this.generateWeekHighlights(summaryData),
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        };

        results.set(userId, props);
      } catch (error) {
        logger.error('EmailDataService: Failed to transform data for user', { 
          userId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    logger.info('EmailDataService: Batch transformation completed', { 
      requestedUsers: userIds.length, 
      successfulUsers: results.size 
    });

    return results;
  }

  /**
   * Get admin summary email data for a completed round
   * This is sent to admins after a round goes from 'scoring' to 'scored'
   */
  async getAdminSummaryEmailProps(roundId: number): Promise<{
    roundName: string;
    roundId: number;
    totalParticipants: number;
    averagePoints: number;
    userScores: Array<{
      userId: string;
      userName: string;
      matchPoints: number;
      dynamicPoints?: number;
      totalPoints: number;
      correctPredictions: number;
      totalPredictions: number;
    }>;
    topScorers: Array<{
      userId: string;
      userName: string;
      matchPoints: number;
      dynamicPoints?: number;
      totalPoints: number;
      correctPredictions: number;
      totalPredictions: number;
    }>;
    completedAt: string;
  }> {
    try {
      logger.info('EmailDataService: Fetching admin summary email data', { roundId });
      
      const supabase = createSupabaseServiceRoleClient();
      
      // Get round information
      const { data: round, error: roundError } = await supabase
        .from('betting_rounds')
        .select('id, name, scored_at')
        .eq('id', roundId)
        .single();
        
      if (roundError || !round) {
        throw new Error(`Round not found: ${roundId}`);
      }

      // Get all user bets for this round with points
      const { data: userBets, error: betsError } = await supabase
        .from('user_bets')
        .select('user_id, prediction, points_awarded')
        .eq('betting_round_id', roundId)
        .not('points_awarded', 'is', null);

      if (betsError) {
        throw new Error(`Failed to fetch user bets: ${betsError.message}`);
      }

      // Get unique user IDs
      const userIds = [...new Set(userBets?.map(bet => bet.user_id) || [])];
      
      // Get user names (fallback to auth.users like other parts of the codebase)
      const userNamesMap = new Map<string, string>();
      
      for (const userId of userIds) {
        try {
          // Try profiles first
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', userId)
            .single();

          if (profile?.full_name?.trim()) {
            userNamesMap.set(userId, profile.full_name.trim());
          } else {
            // Fallback: try auth.users metadata
            const { data: authUser } = await supabase.auth.admin.getUserById(userId);
            if (authUser?.user?.user_metadata) {
              const metadata = authUser.user.user_metadata;
              const name = metadata.full_name || metadata.name || metadata.display_name;
              if (name?.trim()) {
                userNamesMap.set(userId, name.trim());
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to get name for user ${userId}`, { error });
        }
        
        // Final fallback
        if (!userNamesMap.has(userId)) {
          userNamesMap.set(userId, 'Unknown User');
        }
      }

      // Get dynamic points for this round (questionnaire points)
      const { data: dynamicPoints } = await supabase
        .from('user_round_dynamic_points')
        .select('user_id, dynamic_points')
        .eq('betting_round_id', roundId);

      // Aggregate data by user
      const userScoresMap = new Map<string, {
        userId: string;
        userName: string;
        matchPoints: number;
        dynamicPoints: number;
        totalPoints: number;
        correctPredictions: number;
        totalPredictions: number;
      }>();

      // Process match points
      userBets?.forEach(bet => {
        const userId = bet.user_id;
        const existing = userScoresMap.get(userId) || {
          userId,
          userName: userNamesMap.get(userId) || 'Unknown User',
          matchPoints: 0,
          dynamicPoints: 0,
          totalPoints: 0,
          correctPredictions: 0,
          totalPredictions: 0
        };

        existing.matchPoints += bet.points_awarded || 0;
        existing.totalPredictions += 1;
        if (bet.points_awarded && bet.points_awarded > 0) {
          existing.correctPredictions += 1;
        }

        userScoresMap.set(userId, existing);
      });

      // Add dynamic points
      dynamicPoints?.forEach(dp => {
        const existing = userScoresMap.get(dp.user_id);
        if (existing) {
          existing.dynamicPoints = dp.dynamic_points || 0;
        }
      });

      // Calculate total points and convert to array
      const userScores = Array.from(userScoresMap.values()).map(score => ({
        ...score,
        totalPoints: score.matchPoints + score.dynamicPoints
      }));

      // Sort by total points descending
      userScores.sort((a, b) => b.totalPoints - a.totalPoints);

      // Calculate statistics
      const totalParticipants = userScores.length;
      const totalPoints = userScores.reduce((sum, user) => sum + user.totalPoints, 0);
      const averagePoints = totalParticipants > 0 ? totalPoints / totalParticipants : 0;

      // Get top 3 scorers
      const topScorers = userScores.slice(0, 3);

      logger.info('EmailDataService: Successfully prepared admin summary data', {
        roundId,
        totalParticipants,
        averagePoints: averagePoints.toFixed(1),
        topScorer: topScorers[0]?.userName
      });

      return {
        roundName: round.name || `Round ${roundId}`,
        roundId,
        totalParticipants,
        averagePoints,
        userScores,
        topScorers,
        completedAt: round.scored_at || new Date().toISOString()
      };

    } catch (error) {
      logger.error('EmailDataService: Failed to get admin summary email props', {
        error: error instanceof Error ? error.message : 'Unknown error',
        roundId
      });
      throw error;
    }
  }
}

export const emailDataService = new EmailDataService(); 