# Component Restructuring Plan: PredictionButton → ToggleButton

## Overview

We'll move the PredictionButton component from the BettingCoupon folder to the UI folder and rename it to ToggleButton to make it more generic and reusable across the application.

## Current Structure

```
src/components/
├── BettingCoupon/
│   ├── BettingCoupon.tsx
│   ├── PredictionButton.tsx  <-- Current location
│   ├── index.ts
│   └── types.ts
├── Questionnaire/
│   └── ...
└── ui/
    ├── button.tsx
    ├── badge.tsx
    └── ...
```

## Target Structure

```
src/components/
├── BettingCoupon/
│   ├── BettingCoupon.tsx
│   ├── index.ts
│   └── types.ts
├── Questionnaire/
│   └── ...
└── ui/
    ├── button.tsx
    ├── badge.tsx
    ├── toggle-button.tsx  <-- New location
    └── ...
```

## Implementation Steps

### 1. Create the ToggleButton Component

Create a new file `src/components/ui/toggle-button.tsx` with a generalized version of the PredictionButton component:

```tsx
import React from 'react';
import { cn } from "@/lib/utils";

interface ToggleButtonProps {
  label: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ 
  label, 
  isSelected, 
  onClick, 
  className = "",
  size = 'md',
  disabled = false
}) => {
  // Size-specific classes
  const sizeClasses = {
    sm: "px-1 py-0.5 text-xs",
    md: "px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-sm",
    lg: "px-3 py-2 text-base"
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "touch-target-min border rounded-md flex items-center justify-center",
        "font-semibold transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500",
        sizeClasses[size],
        isSelected
          ? "bg-teal-600 text-white border-teal-700 shadow-inner hover:bg-teal-700"
          : "border-gray-300 text-gray-600 bg-white hover:bg-gray-100 hover:border-gray-400",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {label}
    </button>
  );
};

export default ToggleButton;
```

### 2. Update the BettingCoupon Component

Modify `src/components/BettingCoupon/BettingCoupon.tsx` to import the new ToggleButton component:

```tsx
// Change this line:
import PredictionButton from './PredictionButton';

// To this:
import ToggleButton from '../ui/toggle-button';

// Then update the component usage:
// Change this:
<PredictionButton
  key={label}
  label={label}
  isSelected={isSelected}
  onClick={() => handleSelect(match.id, label)}
/>

// To this:
<ToggleButton
  key={label}
  label={label}
  isSelected={isSelected}
  onClick={() => handleSelect(match.id, label)}
/>
```

### 3. Update any exports in index.ts (if necessary)

If `PredictionButton` is exported from `src/components/BettingCoupon/index.ts`, update that file to remove the export.

### 4. Remove the old PredictionButton file

Once all references have been updated and the application is working correctly, remove the old file:
`src/components/BettingCoupon/PredictionButton.tsx`

### 5. Testing

1. Verify that the BettingCoupon component still works correctly with the new ToggleButton
2. Check that the styling and behavior remain consistent
3. Test any edge cases or interactions

## Benefits of This Change

1. **Improved Reusability**: The ToggleButton component is now available for use throughout the application
2. **Better Organization**: UI components are kept in the UI folder, maintaining a clean architecture
3. **Enhanced Flexibility**: The new component has additional props for customization
4. **Future-Proofing**: Makes it easier to extend and maintain the component in the future

## Potential Future Enhancements

1. Add more customization options (colors, animations, etc.)
2. Implement keyboard navigation for accessibility
3. Add support for different shapes (rounded, pill, square)
4. Create variants for different use cases