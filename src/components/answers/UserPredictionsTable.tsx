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

interface UserPrediction {
  user_id: string;
  username?: string;
  league_winner?: string;
  best_goal_difference?: string;
  top_scorer?: string;
  last_place?: string;
}

interface UserPredictionsTableProps {
  data: UserPrediction[];
}

const UserPredictionsTable: React.FC<UserPredictionsTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 my-4 text-sm text-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-300" role="alert">
        No user predictions available yet.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary/90">
              <TableHead className="px-6 py-3 text-xs text-primary-foreground font-semibold">Name</TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>League Winner (3p)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Which team will win the league championship</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Best Goal Difference (3p)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Which team will have the best goal difference</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Top Scorer (3p)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Which player will score the most goals</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Last Place (3p)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Which team will finish in last place</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((prediction, _index) => (
              <TableRow 
                key={prediction.user_id} 
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 ease-in-out"
              >
                <TableCell className="px-6 py-4 font-medium text-gray-900 dark:text-white truncate max-w-xs">
                  {prediction.username || prediction.user_id}
                </TableCell>
                <TableCell className="px-3 py-4 text-center text-gray-700 dark:text-gray-300">
                  {prediction.league_winner || '-'}
                </TableCell>
                <TableCell className="px-3 py-4 text-center text-gray-700 dark:text-gray-300">
                  {prediction.best_goal_difference || '-'}
                </TableCell>
                <TableCell className="px-3 py-4 text-center text-gray-700 dark:text-gray-300">
                  {prediction.top_scorer || '-'}
                </TableCell>
                <TableCell className="px-3 py-4 text-center text-gray-700 dark:text-gray-300">
                  {prediction.last_place || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default UserPredictionsTable; 