# Dropdown Audit for Question Section

This document provides a comprehensive inventory of all dropdown instances in the question section that need to be replaced with the new Combobox component.

## Existing Dropdown Components

The question section currently uses two custom dropdown components:

### 1. TeamSelect Component

**File Path**: `src/components/Questionnaire/TeamSelect.tsx`

**Current Implementation**:
- Custom dropdown implementation using a combination of HTML elements
- Not using shadcn/ui or Combobox
- Implements its own filtering logic and dropdown behavior

**Props Interface**:
```typescript
interface TeamSelectProps {
  teams: Team[];
  selectedTeamId: string | number | null;
  onSelect: (teamId: string | number | null) => void;
  placeholder?: string;
  id?: string;
}
```

**Usage Instances**:
1. League Winner Selection (ID: `league-winner`)
   - Component: `<TeamSelect>`
   - Location: `Questionnaire.tsx` line ~90
   - Prop mapping:
     - teams: Array of team objects
     - selectedTeamId: `predictions.leagueWinner`
     - onSelect: Updates 'leagueWinner' via `updatePrediction`
     - id: "league-winner"
     - placeholder: "Select league winner..."

2. Last Place Selection (ID: `last-place`)
   - Component: `<TeamSelect>`
   - Location: `Questionnaire.tsx` line ~102
   - Prop mapping:
     - teams: Array of team objects
     - selectedTeamId: `predictions.lastPlace`
     - onSelect: Updates 'lastPlace' via `updatePrediction`
     - id: "last-place"
     - placeholder: "Select last place team..."

3. Best Goal Difference Selection (ID: `best-goal-difference`)
   - Component: `<TeamSelect>`
   - Location: `Questionnaire.tsx` line ~114
   - Prop mapping:
     - teams: Array of team objects
     - selectedTeamId: `predictions.bestGoalDifference`
     - onSelect: Updates 'bestGoalDifference' via `updatePrediction`
     - id: "best-goal-difference"
     - placeholder: "Select team with best goal difference..."

**Data Structure**:
```typescript
// Team object structure from types.ts
export interface Team {
  id: string | number;
  name: string;
}
```

**Event Handlers**:
- Uses custom `onSelect` handler that passes the selected team ID
- Implements internal state for dropdown open/close
- Has internal search filtering capability
- Manages focus state internally

**Accessibility**:
- Limited ARIA attributes
- No explicit role attributes
- Basic keyboard interaction without complete accessibility implementation

**Form Integration**:
- Integrated with parent component via the `updatePrediction` function
- Form submission validation checks that values are not null

### 2. PlayerSelect Component

**File Path**: `src/components/Questionnaire/PlayerSelect.tsx`

**Current Implementation**:
- Very similar to TeamSelect, but for player selection
- Custom dropdown implementation
- Not using shadcn/ui or Combobox

**Props Interface**:
```typescript
interface PlayerSelectProps {
  players: Player[];
  teams?: Team[]; // Optional and currently unused
  selectedPlayerId: string | number | null;
  onSelect: (playerId: string | number | null) => void;
  placeholder?: string;
  id?: string;
}
```

**Usage Instances**:
1. Top Scorer Selection (ID: `top-scorer`)
   - Component: `<PlayerSelect>`
   - Location: `Questionnaire.tsx` line ~126
   - Prop mapping:
     - players: Array of player objects
     - teams: Array of team objects (currently unused)
     - selectedPlayerId: `predictions.topScorer`
     - onSelect: Updates 'topScorer' via `updatePrediction`
     - id: "top-scorer"
     - placeholder: "Select top scorer..."

**Data Structure**:
```typescript
// Player object structure from types.ts
export interface Player {
  id: string | number;
  name: string;
  teamId: string | number;
}
```

**Event Handlers**:
- Uses custom `onSelect` handler that passes the selected player ID
- Implements internal state for dropdown open/close
- Has internal search filtering capability
- Manages focus state internally

**Accessibility**:
- Limited ARIA attributes
- No explicit role attributes
- Basic keyboard interaction without complete accessibility implementation

**Form Integration**:
- Integrated with parent component via the `updatePrediction` function
- Form submission validation checks that values are not null

## New Combobox Component Details

**File Path**: `src/components/ui/combobox.tsx`

**Props Interface**:
```typescript
export interface ComboboxProps {
  options: ComboboxOption[]
  selectedValue?: string | null
  onChange: (value: string) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  emptyMessage?: string
  searchPlaceholder?: string
  maxHeight?: number
  filterMode?: 'contains' | 'startsWith' | 'fuzzy'
  caseSensitive?: boolean
  id?: string
  ariaLabel?: string
  ariaLabelledby?: string
  ariaDescribedby?: string
  onOpenChange?: (open: boolean) => void
  showClearButton?: boolean
  searchTerm?: string
  onSearchChange?: (term: string) => void
  open?: boolean
}
```

**Expected Data Structure**:
```typescript
export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
}
```

## Data Transformation Requirements

To successfully replace the existing dropdowns with the new Combobox component, the following data transformations will be needed:

### TeamSelect to Combobox Transformation:

1. Convert Team objects to ComboboxOption format:
   ```typescript
   // From
   interface Team {
     id: string | number;
     name: string;
   }
   
   // To
   interface ComboboxOption {
     value: string;
     label: string;
     disabled?: boolean;
   }
   ```

2. Update event handler mapping:
   ```typescript
   // From
   onSelect: (teamId: string | number | null) => void
   
   // To
   onChange: (value: string) => void
   onClear: () => void  // For null value handling
   ```

3. Value type conversion (handling string/number/null values)

### PlayerSelect to Combobox Transformation:

1. Convert Player objects to ComboboxOption format:
   ```typescript
   // From
   interface Player {
     id: string | number;
     name: string;
     teamId: string | number;
   }
   
   // To
   interface ComboboxOption {
     value: string;
     label: string;
     disabled?: boolean;
   }
   ```

2. Update event handler mapping (similar to TeamSelect)

## Edge Cases and Special Considerations

1. **ID Type Handling**: The current components accept string or number IDs, while Combobox uses string values. Need to handle type conversion.

2. **Null Value Handling**: The current components explicitly handle null values for clearing selections. Combobox uses a separate `onClear` handler.

3. **Form Validation**: Ensure the existing validation logic in `validatePredictions()` continues to work with the new components.

4. **State Management**: The current approach uses direct state updates. May need to integrate with the new `useComboboxState` hook.

5. **Focus Management**: Ensure the new components maintain the same focus behavior during form navigation.

## Implementation Priority

1. Team Selection dropdowns (3 instances) - simpler integration
2. Player Selection dropdown (1 instance) - may need additional logic for team association

## Testing Requirements

- Verify all dropdowns still display the correct options
- Confirm that selections persist correctly in the form state
- Ensure filtering and search still works as expected
- Validate form submission captures the correct values
- Test keyboard navigation and accessibility features 