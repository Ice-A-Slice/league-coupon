import React from 'react';
import { StandingsTableSkeleton } from '@/components/standings/StandingsTableSkeleton';

export default function LoadingStandings() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">League Standings</h1>
      <StandingsTableSkeleton />
    </div>
  );
} 