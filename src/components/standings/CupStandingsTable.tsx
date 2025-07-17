'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StandingsTableSkeleton } from './StandingsTableSkeleton';

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

interface CupStandingsTableProps {
  standings: CupStandingEntry[];
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Helper function to safely get user name
 */
const getUserName = (standing: CupStandingEntry): string => {
  return standing.user?.full_name || 'Unknown Player';
};

const CupStandingsTable: React.FC<CupStandingsTableProps> = ({ 
  standings, 
  isLoading, 
  error 
}) => {
  // Loading state
  if (isLoading) {
    return <StandingsTableSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
        <span className="font-medium">Error!</span> Failed to fetch Last Round Special standings: {error}
      </div>
    );
  }

  // Empty state
  if (!standings || !Array.isArray(standings) || standings.length === 0) {
    return (
      <div className="p-4 my-4 text-sm text-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-300" role="alert">
        No Last Round Special participants yet. The cup will become available when 60% of teams have 5 or fewer games remaining.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
        <Table>
          <TableCaption className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Last Round Special standings. Points earned during the final phase of the season.
          </TableCaption>
          <TableHeader className="bg-primary text-primary-foreground">
            <TableRow>
              <TableHead className="w-[60px] px-3 py-3 text-xs text-primary-foreground font-semibold text-left">Position</TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-left">Player</TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-2">
                    Cup Points
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Points earned during the Last Round Special competition</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((standing, index) => (
              <TableRow 
                key={standing.user_id} 
                className={`${index === 0 ? 'bg-primary/10 dark:bg-primary/20 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} transition-colors duration-150 ease-in-out`}
              >
                <TableCell className="px-3 py-4 font-medium text-gray-900 dark:text-white text-left">
                  {standing.position}
                </TableCell>
                <TableCell className="px-3 py-4 font-medium text-gray-900 dark:text-white text-left">
                  {getUserName(standing)}
                </TableCell>
                <TableCell className="px-3 py-4 font-semibold text-gray-900 dark:text-white text-center">
                  {standing.total_points}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default CupStandingsTable; 