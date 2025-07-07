'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SeasonWinnersList from './SeasonWinnersList';
import LeaderboardTable from './LeaderboardTable';
import { HallOfFameViewProps, HallOfFameViewType, SeasonWinner, PlayerStats } from '@/types/hall-of-fame';
import { TrophyIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface HallOfFameProps extends HallOfFameViewProps {
  defaultView?: HallOfFameViewType;
  onWinnerSelect?: (winner: SeasonWinner) => void;
  onPlayerSelect?: (player: PlayerStats) => void;
}

const HallOfFame: React.FC<HallOfFameProps> = ({
  currentUserId,
  competitionId,
  className,
  defaultView = 'seasons',
  onWinnerSelect,
  onPlayerSelect,
}) => {
  const [activeView, setActiveView] = useState<HallOfFameViewType>(defaultView);

  const handleTabChange = (value: string) => {
    setActiveView(value as HallOfFameViewType);
  };

  return (
    <div className={cn("w-full", className)}>
      <Tabs value={activeView} onValueChange={handleTabChange} className="w-full">
        {/* Tab Navigation */}
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="seasons" className="flex items-center space-x-2">
            <TrophyIcon className="h-4 w-4" />
            <span>Season Winners</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center space-x-2">
            <ChartBarIcon className="h-4 w-4" />
            <span>Leaderboard</span>
          </TabsTrigger>
        </TabsList>

        {/* Season Winners View */}
        <TabsContent value="seasons" className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Hall of Fame</h2>
            <p className="text-gray-600">
              Celebrate the champions of each season and their outstanding achievements
            </p>
          </div>
          
          <SeasonWinnersList
            currentUserId={currentUserId}
            competitionId={competitionId}
            onWinnerSelect={onWinnerSelect}
          />
        </TabsContent>

        {/* Leaderboard View */}
        <TabsContent value="leaderboard" className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Player Leaderboard</h2>
            <p className="text-gray-600">
              Rankings and statistics for all players across multiple seasons
            </p>
          </div>
          
          <LeaderboardTable
            currentUserId={currentUserId}
            competitionId={competitionId}
            onPlayerSelect={onPlayerSelect}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HallOfFame; 