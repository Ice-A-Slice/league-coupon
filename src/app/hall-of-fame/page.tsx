import React from 'react';
import { Metadata } from 'next';
import HallOfFame from '@/components/hall-of-fame/HallOfFame';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/utils/logger';

export const metadata: Metadata = {
  title: 'Hall of Fame | TippSlottet',
  description: 'Celebrate the champions and view player rankings across multiple seasons in our Hall of Fame.',
  keywords: ['hall of fame', 'champions', 'leaderboard', 'rankings', 'winners', 'statistics'],
};

/**
 * Hall of Fame Page - Server Component
 * 
 * Displays the Hall of Fame with season winners and leaderboard.
 * Shows user-specific highlighting for authenticated users.
 */
export default async function HallOfFamePage() {
  let currentUserId: string | undefined;
  let competitionId: number | undefined;

  try {
    // Get the current user if authenticated
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      logger.warn('Hall of Fame: Failed to get user', { error: userError.message });
    } else if (user) {
      currentUserId = user.id;
      logger.info('Hall of Fame: User authenticated', { userId: user.id });
    }

    // Get the current competition/league information
    const { data: currentSeasonData, error: seasonError } = await supabase
      .from('seasons')
      .select(`
        competition_id,
        competitions (
          id,
          name,
          api_league_id
        )
      `)
      .eq('is_current', true)
      .single();

    if (seasonError) {
      logger.warn('Hall of Fame: Failed to get current season', { error: seasonError.message });
      // Default to Premier League if we can't get current season
      competitionId = 39;
    } else if (currentSeasonData?.competition_id) {
      competitionId = currentSeasonData.competition_id;
      logger.info('Hall of Fame: Current competition found', { 
        competitionId: currentSeasonData.competition_id,
        competitionName: currentSeasonData.competitions?.name 
      });
    }

  } catch (error) {
    logger.error('Hall of Fame: Unexpected error during page load', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Continue with undefined values - the component will handle it gracefully
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Hall of Fame</h1>
      <p className="text-gray-600 mb-6">
        Celebrate the champions of each season and their outstanding achievements
      </p>
      <HallOfFame 
        currentUserId={currentUserId}
        competitionId={competitionId}
        defaultView="seasons"
      />
    </div>
  );
} 