'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Import shadcn/ui Table components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components
import { StandingsTableSkeleton } from './StandingsTableSkeleton'; // Import the skeleton component

// TODO: Define a more specific type for a standing entry based on API response
interface StandingEntry {
  user_id: string;
  rank: number;
  username?: string; // Assuming we'll get username eventually
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
  // Guard clauses - check for loading state first
  if (isLoading) {
    return <StandingsTableSkeleton />; // Render skeleton loader
  }

  // Check for errors
  if (error) {
    return (
      <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
        <span className="font-medium">Error!</span> Failed to fetch standings: {error}
      </div>
    );
  }

  // Check for empty or invalid data - this is crucial to prevent .map() errors
  if (!standings || !Array.isArray(standings) || standings.length === 0) {
    return (
      <div className="p-4 my-4 text-sm text-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-300" role="alert">
        No standings data available yet.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
        <Table>
          <TableHeader className="bg-primary text-primary-foreground">
            <TableRow>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">#</TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-left">Player</TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 rounded">
                    <span className="hidden sm:inline">Game Points</span>
                    <span className="sm:hidden">GP</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Points from match outcome predictions</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 rounded">
                    <span className="hidden sm:inline">Question Points</span>
                    <span className="sm:hidden">QP</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Points from season-long questionnaire predictions</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 rounded">
                    <span className="hidden sm:inline">Total Points</span>
                    <span className="sm:hidden">TP</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Combined total of game points and question points</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((entry, index) => (
              <TableRow 
                key={entry.user_id} 
                className={`${index === 0 ? 'bg-primary/10 dark:bg-primary/20 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} transition-colors duration-150 ease-in-out`}
              >
                <TableCell className="px-3 py-4 font-medium text-gray-900 dark:text-white text-center">
                  {entry.rank}
                </TableCell>
                <TableCell className="px-3 py-4 font-medium text-gray-900 dark:text-white text-left">
                  {entry.username || 'Unknown Player'}
                </TableCell>
                <TableCell className="px-3 py-4 text-gray-900 dark:text-white text-center">
                  {entry.game_points}
                </TableCell>
                <TableCell className="px-3 py-4 text-gray-900 dark:text-white text-center">
                  {entry.dynamic_points}
                </TableCell>
                <TableCell className="px-3 py-4 font-semibold text-gray-900 dark:text-white text-center">
                  {entry.combined_total_score}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default StandingsTable; 