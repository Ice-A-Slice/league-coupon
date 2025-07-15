'use client';

import React, { useState } from 'react';
import { useHallOfFameStats } from '@/hooks/useHallOfFame';
import { HallOfFameViewProps, LeaderboardFilters, PlayerStats } from '@/types/hall-of-fame';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ChevronUpIcon, ChevronDownIcon, TrophyIcon, StarIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LeaderboardTableProps extends HallOfFameViewProps {
  onPlayerSelect?: (player: PlayerStats) => void;
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  currentUserId,
  competitionId,
  className,
  onPlayerSelect
}) => {
  const [filters, setFilters] = useState<LeaderboardFilters>({
    sort: 'wins_desc',
    limit: 50,
    includeSeasons: false,
  });

  const { data, loading, error, refetch } = useHallOfFameStats(filters, competitionId);

  const handleSortChange = (newSort: LeaderboardFilters['sort']) => {
    setFilters(prev => ({
      ...prev,
      sort: newSort,
    }));
  };

  const toggleSeasonDetails = () => {
    setFilters(prev => ({
      ...prev,
      includeSeasons: !prev.includeSeasons,
    }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  const isCurrentUser = (userId: string) => {
    return currentUserId && userId === currentUserId;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <StarIcon className="h-5 w-5 text-amber-500" />;
      case 2:
        return <TrophyIcon className="h-5 w-5 text-gray-400" />;
      case 3:
        return <TrophyIcon className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-gray-500 font-medium">#{rank}</span>;
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-red-50 border border-red-200 rounded-lg p-6", className)}>
        <div className="flex items-center space-x-2 text-red-700">
          <span className="font-medium">Error loading leaderboard</span>
        </div>
        <p className="text-red-600 mt-2">{error}</p>
        <Button
          onClick={refetch}
          variant="outline"
          size="sm"
          className="mt-4 border-red-300 text-red-700 hover:bg-red-50"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!data || data.data.leaderboard.length === 0) {
    return (
      <div className={cn("bg-gray-50 border border-gray-200 rounded-lg p-8 text-center", className)}>
        <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Statistics Yet</h3>
        <p className="text-gray-600">
          No player statistics available yet. Check back after seasons are completed!
        </p>
      </div>
    );
  }

  const { leaderboard, overall_stats } = data.data;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={filters.sort}
              onChange={(e) => handleSortChange(e.target.value as LeaderboardFilters['sort'])}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="wins_desc">Most Wins</option>
              <option value="wins_asc">Fewest Wins</option>
              <option value="points_desc">Highest Points</option>
              <option value="points_asc">Lowest Points</option>
              <option value="recent">Most Recent Win</option>
            </select>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSeasonDetails}
            className="flex items-center space-x-1"
          >
            <span>Season Details</span>
            {filters.includeSeasons ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          {overall_stats.total_players} players • {overall_stats.total_seasons_completed} seasons
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {overall_stats.total_players}
          </div>
          <div className="text-sm text-gray-600">Total Players</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {overall_stats.total_seasons_completed}
          </div>
          <div className="text-sm text-gray-600">Seasons Completed</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {overall_stats.total_points_awarded.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Points Awarded</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {overall_stats.average_points_per_season}
          </div>
          <div className="text-sm text-gray-600">Avg Points/Season</div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wins
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Points
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Points
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Best Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latest Win
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((player, index) => (
                <React.Fragment key={player.user.id}>
                  <tr 
                    className={cn(
                      "hover:bg-gray-50 cursor-pointer transition-colors",
                      isCurrentUser(player.user.id) && "bg-teal-50 hover:bg-teal-100"
                    )}
                    onClick={() => onPlayerSelect?.(player)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getRankIcon(index + 1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          {player.user.avatar_url ? (
                            <Image 
                              src={player.user.avatar_url} 
                              alt={player.user.full_name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <span className="text-gray-500 font-medium">
                              {player.user.full_name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="font-medium text-gray-900">
                              {player.user.full_name}
                            </div>
                            {isCurrentUser(player.user.id) && (
                              <span className="bg-teal-100 text-teal-800 text-xs font-medium px-2 py-1 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            First win: {formatDate(player.first_win_date)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {player.total_wins}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {player.total_points.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {player.average_points}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {player.best_points}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {formatDate(player.latest_win_date)}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Season Details Expansion */}
                  {filters.includeSeasons && player.seasons_won && player.seasons_won.length > 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700">
                            Season Wins ({player.seasons_won.length}):
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {player.seasons_won.map((season) => (
                              <div 
                                key={season.season_id}
                                className="bg-white border rounded p-3 text-xs"
                              >
                                <div className="font-medium text-gray-900">
                                  {season.season_name}
                                </div>
                                <div className="text-gray-600">
                                  {season.competition.name}
                                </div>
                                <div className="text-gray-500">
                                  {season.points} points
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardTable; 