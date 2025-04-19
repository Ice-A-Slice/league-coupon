import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have a utility for classnames

interface ValidationStatusIndicatorProps {
  isValid: boolean | null | undefined; // null/undefined for initial/untouched state
  hasError: boolean;
  className?: string;
}

const ValidationStatusIndicator: React.FC<ValidationStatusIndicatorProps> = ({ 
  isValid,
  hasError,
  className 
}) => {
  if (hasError) {
    return (
      <XCircle 
        className={cn("h-4 w-4 text-red-500", className)}
        aria-label="Invalid input"
        data-testid="validation-error-icon"
      />
    );
  } else if (isValid === true) { // Explicitly check for true to distinguish from initial state
    return (
      <CheckCircle 
        className={cn("h-4 w-4 text-green-500", className)}
        aria-label="Valid input"
        data-testid="validation-success-icon"
      />
    );
  } else if (isValid === undefined || isValid === null) {
    // Optional: Indicate untouched state (e.g., a neutral icon or nothing)
    // Example: return <AlertCircle className={cn("h-4 w-4 text-gray-400", className)} aria-label="Input not yet validated" />; 
    return null; // Return nothing for initial state
  }

  // Fallback or other states (e.g., in-progress)
  return null;
};

export default ValidationStatusIndicator; 