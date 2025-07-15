import React from 'react';
import { StandingsTableSkeleton } from '@/components/standings/StandingsTableSkeleton';

export default function LoadingStandings() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 sm:mb-0">Standings</h1>
        {/* Skeleton badge */}
        <div className="w-32 h-6 bg-gray-200 rounded-full animate-pulse"></div>
      </div>

      {/* Simple loading layout - tabs will appear after data loads if needed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {/* Skeleton heading */}
          <div className="h-7 w-48 bg-gray-200 rounded animate-pulse"></div>
          {/* Skeleton player count */}
          <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        
        <StandingsTableSkeleton />
      </div>
    </div>
  );
} 