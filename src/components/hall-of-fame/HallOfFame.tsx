'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SeasonWinnersList from './SeasonWinnersList';
import LeaderboardTable from './LeaderboardTable';
import { HallOfFameViewProps, HallOfFameViewType, PlayerStats } from '@/types/hall-of-fame';
import { TrophyIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface HallOfFameProps extends HallOfFameViewProps {
  defaultView?: HallOfFameViewType;
  onWinnerSelect?: (winnerId: string) => void;
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
          
          <SeasonWinnersList
            currentUserId={currentUserId}
            competitionId={competitionId}
            onWinnerSelect={onWinnerSelect}
          />
        </TabsContent>

        {/* Leaderboard View */}
        <TabsContent value="leaderboard" className="space-y-6">
          
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