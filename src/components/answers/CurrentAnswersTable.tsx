'use client';

import React from 'react';
import {
  Table,
  TableBody,
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

interface CurrentAnswer {
  question_type: string;
  question_label: string;
  current_answer: string;
  points_value: number;
  row_index: number;
}

interface CurrentAnswersTableProps {
  data: CurrentAnswer[];
}

const CurrentAnswersTable: React.FC<CurrentAnswersTableProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 my-4 text-sm text-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-gray-300" role="alert">
        No current answers available yet.
      </div>
    );
  }

  // Group data by row_index to create multiple rows for ties
  const rowGroups = new Map<number, Map<string, string>>();
  
  data.forEach(answer => {
    if (!rowGroups.has(answer.row_index)) {
      rowGroups.set(answer.row_index, new Map());
    }
    rowGroups.get(answer.row_index)!.set(answer.question_type, answer.current_answer);
  });

  // Sort row indices to ensure consistent ordering
  const sortedRowIndices = Array.from(rowGroups.keys()).sort((a, b) => a - b);

  return (
    <TooltipProvider>
      <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary hover:bg-primary/90">
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold">
                League Winner{' '}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">(?)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Current team in 1st place</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold">
                Best Goal Difference{' '}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">(?)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Team with highest goal difference</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold">
                Top Scorer{' '}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">(?)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Player with most goals scored</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="px-3 py-3 text-xs text-primary-foreground font-semibold">
                Last Place{' '}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">(?)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Current team in last place</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRowIndices.map((rowIndex) => {
              const rowData = rowGroups.get(rowIndex)!;
              return (
                <TableRow 
                  key={rowIndex}
                  className="bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors duration-150 ease-in-out"
                >
                  <TableCell className="px-3 py-4 font-semibold text-primary dark:text-teal-400">
                    {rowData.get('league_winner') || ''}
                  </TableCell>
                  <TableCell className="px-3 py-4 font-semibold text-primary dark:text-teal-400">
                    {rowData.get('best_goal_difference') || ''}
                  </TableCell>
                  <TableCell className="px-3 py-4 font-semibold text-primary dark:text-teal-400">
                    {rowData.get('top_scorer') || ''}
                  </TableCell>
                  <TableCell className="px-3 py-4 font-semibold text-primary dark:text-teal-400">
                    {rowData.get('last_place') || ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
      </div>
    </TooltipProvider>
  );
};

export default CurrentAnswersTable; 