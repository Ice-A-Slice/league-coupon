import React from 'react';
import { cn } from "@/lib/utils";

interface ToggleButtonProps {
  label: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  'data-match-id'?: string;
  'data-selection'?: string;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ 
  label, 
  isSelected, 
  onClick, 
  className = "",
  size = 'md',
  disabled = false,
  'data-match-id': matchId,
  'data-selection': selection,
  ...rest
}) => {
  // Size-specific classes
  const sizeClasses = {
    sm: "px-1 py-0.5 text-xs",
    md: "px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-sm",
    lg: "px-3 py-2 text-base"
  };

  // Create a handler with additional logging
  const handleClick = (e: React.MouseEvent) => {
    console.log(`👆 BUTTON CLICKED - Match: ${matchId}, Selection: ${selection}, Current isSelected: ${isSelected}`);
    
    try {
      // Call the original onClick handler
      onClick();
      console.log(`✅ onClick handler completed for Match: ${matchId}, Selection: ${selection}`);
    } catch (error) {
      console.error(`❌ Error in onClick handler for Match: ${matchId}, Selection: ${selection}:`, error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-selected={isSelected} 
      data-match-id={matchId}
      data-selection={selection}
      className={cn(
        "touch-target-min border rounded-md flex items-center justify-center",
        "font-semibold transition-all duration-100",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500",
        sizeClasses[size],
        isSelected
          ? "bg-teal-600 text-white border-teal-700 shadow-sm font-bold !important"
          : "border-gray-300 text-gray-600 bg-white hover:bg-gray-100 hover:border-gray-400",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...rest}
    >
      {label}
    </button>
  );
};

export default ToggleButton; 