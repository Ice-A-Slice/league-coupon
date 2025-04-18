# Combobox State Management

This document describes the state management interface created for the Combobox component.

## Overview

The Combobox state management system provides a standardized way to manage the state of Combobox components throughout the application. It implements a Redux-like pattern with actions, reducers, and selectors, but scoped to individual component instances.

## Files

- `src/lib/combobox-state.ts` - Core state management implementation
- `src/lib/utils.ts` - Helper utilities for Combobox state

## Usage

### Basic Usage with Hook

The simplest way to use the state management system is with the `useComboboxState` hook:

```tsx
import { useComboboxState } from '@/lib/combobox-state';
import { Combobox } from '@/components/ui/combobox';

const MyComponent = () => {
  const {
    state,
    handleSelect,
    handleClear,
    handleOpenChange,
    handleSearchChange,
  } = useComboboxState({
    initialValue: 'apple',
    onChange: (value) => console.log('Selected:', value),
  });

  const options = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'orange', label: 'Orange' },
  ];

  return (
    <Combobox
      options={options}
      selectedValue={state.selectedValue}
      onChange={handleSelect}
      onOpenChange={handleOpenChange}
      // Additional props...
    />
  );
};
```

### Manual Integration

You can also use the reducer directly if you need more control:

```tsx
import { useReducer } from 'react';
import {
  comboboxReducer,
  initialComboboxState,
  setSelection,
} from '@/lib/combobox-state';

const MyComponent = () => {
  const [state, dispatch] = useReducer(comboboxReducer, initialComboboxState);

  const handleSelect = (value) => {
    dispatch(setSelection(value));
    // Additional logic...
  };

  // Rest of component...
};
```

## State Interface

The Combobox state consists of:

```ts
interface ComboboxState {
  selectedValue: string | null;
  isOpen: boolean;
  searchTerm: string;
}
```

## Actions

The following actions are available:

| Action | Description |
|--------|-------------|
| `setSelection(value)` | Set the selected value |
| `clearSelection()` | Clear the current selection |
| `setOpenState(isOpen)` | Open or close the dropdown |
| `setSearchTerm(term)` | Set the search term |
| `resetCombobox()` | Reset to initial state |

## Helper Functions

The system includes several helper functions:

- `getSelectedValue(state)` - Get the selected value
- `getIsOpen(state)` - Check if the dropdown is open
- `getSearchTerm(state)` - Get the current search term
- `getSelectedOption(state, options)` - Get the selected option object
- `filterComboboxOptions(options, searchTerm, filterMode, caseSensitive)` - Filter options based on search

## Testing

The state management system includes comprehensive tests in `src/lib/__tests__/combobox-state.test.ts`.

## Best Practices

1. Use the `useComboboxState` hook for most cases
2. Handle external state changes by connecting parent state to the hook
3. Use `onChange` callback for integration with form libraries
4. Consider debouncing search term changes for performance 