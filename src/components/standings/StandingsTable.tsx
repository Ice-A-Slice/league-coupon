'use client';

import React from 'react';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Import shadcn/ui Table components

// TODO: Define a more specific type for a standing entry based on API response
interface StandingEntry {
  user_id: string;
  rank: number;
  username?: string; // Assuming we'll get username eventually
  avatar_url?: string; // Assuming optional avatar
  game_points: number;
  dynamic_points: number;
  combined_total_score: number;
}

interface StandingsTableProps {
  standings: StandingEntry[];
  isLoading?: boolean;
  error?: string | null;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ standings, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner size={48} />
        <span className="ml-4 text-lg text-gray-600 dark:text-gray-400">Loading standings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
        <span className="font-medium">Error!</span> Failed to fetch standings: {error}
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="p-4 my-4 text-sm text-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-300" role="alert">
        No standings data available yet.
      </div>
    );
  }

  return (
    <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
      <Table>
        {/* <TableCaption className="py-4 text-xs text-gray-500 dark:text-gray-400">
          League Standings - Points updated periodically.
        </TableCaption> */}
        <TableHeader>
          <TableRow className="bg-primary hover:bg-primary/90">
            <TableHead className="px-6 py-3 text-primary-foreground font-semibold">Rank</TableHead>
            <TableHead className="px-6 py-3 text-primary-foreground font-semibold">Player</TableHead>
            <TableHead className="px-6 py-3 text-center text-primary-foreground font-semibold">Game Points</TableHead>
            <TableHead className="px-6 py-3 text-center text-primary-foreground font-semibold">Dynamic Points</TableHead>
            <TableHead className="px-6 py-3 text-center text-primary-foreground font-semibold">Total Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((entry, index) => (
            <TableRow 
              key={entry.user_id} 
              className={`${index === 0 ? 'bg-primary/10 dark:bg-primary/20 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} transition-colors duration-150 ease-in-out`}
            >
              <TableCell className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                {entry.rank}
              </TableCell>
              <TableCell className="px-6 py-4 flex items-center text-gray-800 dark:text-gray-200">
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-3 flex-shrink-0">
                  {/* TODO: Add actual avatar if available */}
                </div>
                {entry.username || entry.user_id} 
              </TableCell>
              <TableCell className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">
                {entry.game_points}
              </TableCell>
              <TableCell className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">
                {entry.dynamic_points}
              </TableCell>
              <TableCell className="px-6 py-4 text-center font-semibold text-primary dark:text-teal-400">
                {entry.combined_total_score}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default StandingsTable; 