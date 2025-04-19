import React from 'react';

interface PredictionButtonProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

const PredictionButton: React.FC<PredictionButtonProps> = ({ label, isSelected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      // Enhanced styling with responsive accommodations
      className={`touch-target-min px-1.5 py-1 sm:px-2.5 sm:py-1.5
        border rounded-md flex items-center justify-center
        text-sm font-semibold transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${isSelected
          ? 'bg-teal-600 text-white border-teal-700 shadow-inner hover:bg-teal-700' // Clearer selected state
          : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-100 hover:border-gray-400' // Standard state
        }`}
    >
      {label}
    </button>
  );
};

export default PredictionButton; 