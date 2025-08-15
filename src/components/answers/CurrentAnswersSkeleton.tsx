'use client';

import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CurrentAnswersSkeleton: React.FC = () => {
  return (
    <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary hover:bg-primary/90">
            <TableHead className="px-6 py-3 text-xs text-primary-foreground font-semibold">Question</TableHead>
            <TableHead className="px-4 py-3 text-xs text-primary-foreground font-semibold text-center">Current Answer</TableHead>
            <TableHead className="px-4 py-3 text-xs text-primary-foreground font-semibold text-center">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 ease-in-out">
              <TableCell className="px-6 py-4">
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="px-4 py-4 text-center">
                <Skeleton className="h-4 w-20 mx-auto" />
              </TableCell>
              <TableCell className="px-4 py-4 text-center">
                <Skeleton className="h-4 w-8 mx-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CurrentAnswersSkeleton;