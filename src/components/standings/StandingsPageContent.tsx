'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import StandingsTable from './StandingsTable';
import CupStandingsTable from './CupStandingsTable';
import { StandingsTableSkeleton } from './StandingsTableSkeleton';

// League standings interface
interface UserStandingEntry {
  user_id: string;
  game_points: number;
  dynamic_points: number;
  combined_total_score: number;
  rank: number;
  username?: string;
}

// Cup standings interface
interface CupStandingEntry {
  user_id: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  total_points: number;
  rounds_participated: number;
  position: number;
  last_updated: string;
}

// Cup status interface
interface CupStatus {
  is_active: boolean;
  season_id: number | null;
  season_name: string | null;
  activated_at: string | null;
}

interface StandingsPageContentProps {
  leagueStandings: UserStandingEntry[] | null;
  cupStandings: CupStandingEntry[] | null;
  cupStatus: CupStatus | null;
}

export function StandingsPageContent({ 
  leagueStandings, 
  cupStandings, 
  cupStatus 
}: StandingsPageContentProps) {
  const [activeTab, setActiveTab] = useState<'league' | 'cup'>('league');

  // Determine if cup tab should be shown
  const showCupTab = cupStatus?.is_active === true;
  
  // Handle error states
  const leagueError = !leagueStandings ? 'Failed to load league standings' : null;
  const cupError = showCupTab && !cupStandings ? 'Failed to load cup standings' : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 sm:mb-0">Standings</h1>
        {showCupTab && cupStatus?.season_name && (
          <Badge variant="secondary" className="w-fit">
            Last Round Special Active
          </Badge>
        )}
      </div>

      {showCupTab ? (
        /* Show tabs when cup is active */
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as 'league' | 'cup')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="league" className="flex-1">
              League Standings
            </TabsTrigger>
            <TabsTrigger value="cup" className="flex-1">
              Last Round Special
            </TabsTrigger>
          </TabsList>

          <TabsContent value="league" className="mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Regular Season Standings</h2>
                <Badge variant="outline">
                  {leagueStandings?.length || 0} Players
                </Badge>
              </div>
              
              {leagueError ? (
                <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                  <span className="font-medium">Error!</span> {leagueError}
                </div>
              ) : (leagueStandings && Array.isArray(leagueStandings)) ? (
                <StandingsTable standings={leagueStandings} />
              ) : (
                <StandingsTableSkeleton />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cup" className="mt-0">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Last Round Special Standings</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {cupStandings?.length || 0} Participants
                  </Badge>
                  {cupStatus?.activated_at && (
                    <Badge variant="secondary">
                      Started {new Date(cupStatus.activated_at).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Last Round Special:</span> Special competition mode activated. 
                  Points earned during this period contribute to cup standings.
                </p>
              </div>

              {cupError ? (
                <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
                  <span className="font-medium">Error!</span> {cupError}
                </div>
              ) : (cupStandings && Array.isArray(cupStandings)) ? (
                <CupStandingsTable standings={cupStandings} />
              ) : (
                <StandingsTableSkeleton />
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        /* Show standings directly when no cup is active */
        <div className="space-y-4">
          {leagueError ? (
            <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
              <span className="font-medium">Error!</span> {leagueError}
            </div>
          ) : (leagueStandings && Array.isArray(leagueStandings)) ? (
            <StandingsTable standings={leagueStandings} />
          ) : (
            <StandingsTableSkeleton />
          )}
        </div>
      )}

      {/* Help text */}
      <div className="mt-8 text-sm text-gray-600">
        <p>
          Standings are updated in real-time as matches are completed. 
          {showCupTab && ' The Last Round Special runs parallel to the regular season.'}
        </p>
      </div>
    </div>
  );
} 