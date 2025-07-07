'use client';

import React, { useState } from 'react';
import { useHallOfFame } from '@/hooks/useHallOfFame';
import { HallOfFameViewProps, HallOfFameFilters, SeasonWinner } from '@/types/hall-of-fame';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface SeasonWinnersListProps extends HallOfFameViewProps {
  onWinnerSelect?: (winner: SeasonWinner) => void;
}

const SeasonWinnersList: React.FC<SeasonWinnersListProps> = ({
  currentUserId,
  competitionId,
  className,
  onWinnerSelect
}) => {
  const [filters, setFilters] = useState<HallOfFameFilters>({
    sort: 'newest',
    limit: 10,
    page: 1,
  });

  const { data, loading, error, refetch } = useHallOfFame(filters, competitionId);

  const handleSortChange = (newSort: HallOfFameFilters['sort']) => {
    setFilters(prev => ({
      ...prev,
      sort: newSort,
      page: 1, // Reset to first page when sorting changes
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isCurrentUser = (userId: string) => {
    return currentUserId && userId === currentUserId;
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
          <span className="font-medium">Error loading Hall of Fame</span>
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

  if (!data || data.data.length === 0) {
    return (
      <div className={cn("bg-gray-50 border border-gray-200 rounded-lg p-8 text-center", className)}>
        <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Winners Yet</h3>
        <p className="text-gray-600">
          No season winners have been determined yet. Check back after seasons are completed!
        </p>
      </div>
    );
  }

  const { pagination } = data;
  const winners = data.data;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <select
            value={filters.sort}
            onChange={(e) => handleSortChange(e.target.value as HallOfFameFilters['sort'])}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="points_desc">Highest Points</option>
            <option value="points_asc">Lowest Points</option>
          </select>
        </div>
        
        <div className="text-sm text-gray-600">
          {pagination.total_items} total winners
        </div>
      </div>

      {/* Winners List */}
      <div className="space-y-4">
        {winners.map((winner) => (
          <div
            key={winner.id}
            className={cn(
              "bg-white border rounded-lg p-6 transition-all duration-200 hover:shadow-md cursor-pointer",
              isCurrentUser(winner.user_id) && "ring-2 ring-teal-500 bg-teal-50 border-teal-200"
            )}
            onClick={() => onWinnerSelect?.(winner)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {/* Trophy Icon */}
                <div className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
                  isCurrentUser(winner.user_id) ? "bg-teal-100" : "bg-amber-100"
                )}>
                  <TrophyIcon className={cn(
                    "h-6 w-6",
                    isCurrentUser(winner.user_id) ? "text-teal-600" : "text-amber-600"
                  )} />
                </div>

                {/* Winner Info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {winner.user.full_name}
                    </h3>
                    {isCurrentUser(winner.user_id) && (
                      <span className="bg-teal-100 text-teal-800 text-xs font-medium px-2 py-1 rounded">
                        You
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">
                      {winner.season.name} ({winner.season.api_season_year})
                    </p>
                    <p className="text-sm text-gray-600">
                      {winner.season.competition.name} • {winner.season.competition.country_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Won on {formatDate(winner.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Points */}
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {winner.total_points}
                </div>
                <div className="text-xs text-gray-500">points</div>
                <div className="text-xs text-gray-400 mt-1">
                  Game: {winner.game_points} • Dynamic: {winner.dynamic_points}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-6">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page <= 1}
              className="flex items-center space-x-1"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span>Previous</span>
            </Button>
            
            <span className="text-sm text-gray-600">
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page >= pagination.total_pages}
              className="flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-gray-500">
            Showing {((filters.page - 1) * filters.limit) + 1} to{' '}
            {Math.min(filters.page * filters.limit, pagination.total_items)} of{' '}
            {pagination.total_items} winners
          </div>
        </div>
      )}
    </div>
  );
};

export default SeasonWinnersList; 