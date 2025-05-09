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

export const StandingsTableSkeleton: React.FC = () => {
  const skeletonRowCount = 5; // Display 5 skeleton rows

  return (
    <div className="border shadow-md sm:rounded-lg my-6 overflow-hidden">
      <Table>
        <TableCaption className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400 text-left">
          Loading standings data...
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-gray-200 dark:bg-gray-700 animate-pulse">
            <TableHead className="px-3 py-3 text-xs">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            </TableHead>
            <TableHead className="px-6 py-3 text-xs">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            </TableHead>
            <TableHead className="px-3 py-3 text-xs text-center">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mx-auto"></div>
            </TableHead>
            <TableHead className="px-3 py-3 text-xs text-center">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mx-auto"></div>
            </TableHead>
            <TableHead className="px-3 py-3 text-xs text-center">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mx-auto"></div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(skeletonRowCount)].map((_, index) => (
            <TableRow key={index} className="animate-pulse">
              <TableCell className="px-3 py-4 text-center">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mx-auto"></div>
              </TableCell>
              <TableCell className="px-6 py-4">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              </TableCell>
              <TableCell className="px-3 py-4 text-center">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mx-auto"></div>
              </TableCell>
              <TableCell className="px-3 py-4 text-center">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mx-auto"></div>
              </TableCell>
              <TableCell className="px-3 py-4 text-center">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mx-auto"></div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}; 