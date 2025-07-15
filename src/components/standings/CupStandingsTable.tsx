'use client';

import React from 'react';
import Image from 'next/image';
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
import { Badge } from "@/components/ui/badge";
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

export function CupStandingsTable({ standings, isLoading, error }: CupStandingsTableProps) {
  if (isLoading) {
    return <StandingsTableSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 my-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400" role="alert">
        <span className="font-medium">Error!</span> Failed to fetch cup standings: {error}
      </div>
    );
  }

  if (!standings || !Array.isArray(standings) || standings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-lg mb-2">No cup standings available</p>
        <p className="text-sm">Cup standings will appear once participants join the Last Round Special.</p>
      </div>
    );
  }

  // Helper function to determine position styling
  const getPositionBadge = (position: number) => {
    if (position === 1) {
      return <Badge className="bg-yellow-500 text-yellow-50 hover:bg-yellow-600">🥇 1st</Badge>;
    } else if (position === 2) {
      return <Badge className="bg-gray-400 text-gray-50 hover:bg-gray-500">🥈 2nd</Badge>;
    } else if (position === 3) {
      return <Badge className="bg-amber-600 text-amber-50 hover:bg-amber-700">🥉 3rd</Badge>;
    } else {
      return <Badge variant="outline">{position}</Badge>;
    }
  };

  // Helper function to get user initials for avatar fallback
  const getUserInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption className="text-sm text-gray-600 mt-4">
          Last Round Special standings showing cup competition performance
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px] text-center">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">Cup Points</TableHead>
            <TableHead className="text-center hidden sm:table-cell">Rounds</TableHead>
            <TableHead className="text-center hidden md:table-cell">Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((standing) => (
            <TableRow 
              key={standing.user_id} 
              className="hover:bg-gray-50 transition-colors"
            >
              {/* Position/Rank */}
              <TableCell className="text-center">
                {getPositionBadge(standing.position)}
              </TableCell>

              {/* Player info with avatar */}
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {standing.user.avatar_url ? (
                      <Image
                        src={standing.user.avatar_url}
                        alt={`${standing.user.full_name} avatar`}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full border border-gray-200"
                      />
                    ) : null}
                    <div 
                      className={`w-8 h-8 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-xs font-medium text-teal-700 ${standing.user.avatar_url ? 'hidden' : 'flex'}`}
                    >
                      {getUserInitials(standing.user.full_name)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {standing.user.full_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      ID: {standing.user_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </TableCell>

              {/* Cup Points */}
              <TableCell className="text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="font-semibold text-lg text-teal-700">
                        {standing.total_points}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total points earned in Last Round Special</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>

              {/* Rounds Participated */}
              <TableCell className="text-center hidden sm:table-cell">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="secondary">
                        {standing.rounds_participated}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Number of cup rounds participated in</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>

              {/* Last Updated */}
              <TableCell className="text-center hidden md:table-cell">
                <span className="text-xs text-gray-500">
                  {new Date(standing.last_updated).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 