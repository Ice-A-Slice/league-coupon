'use client'

import * as React from 'react'
import { Button } from "@/components/ui/button"
import { Combobox, ComboboxOption } from "@/components/ui/combobox"
import { useComboboxState } from "@/lib/combobox-state"
import { Badge } from "@/components/ui/badge"

export interface ComboboxExampleProps {
  /** Array of options for the combobox */
  options: ComboboxOption[]
  /** Initial selected value */
  initialValue?: string | null
  /** Callback when selection changes */
  onChange?: (value: string | null) => void
  /** Placeholder text */
  placeholder?: string
  /** Label for the combobox */
  label?: string
  /** ID for the combobox */
  id?: string
  /** Disabled state */
  disabled?: boolean
}

/**
 * Example demonstrating controlled Combobox component pattern
 * 
 * This component fully implements the controlled component pattern,
 * connecting the Combobox component to the application's state management.
 */
export function ComboboxExample({
  options,
  initialValue = null,
  onChange,
  placeholder = "Select an option...",
  label = "Combobox",
  id = "demo-combobox",
  disabled = false
}: ComboboxExampleProps) {
  // Use our custom hook to manage combobox state
  const {
    state,
    handleSelect,
    handleClear,
    handleOpenChange,
    handleSearchChange,
    resetState
  } = useComboboxState({
    initialState: {
      selectedValue: initialValue,
    },
    onChange,
  })

  // Update state if initialValue changes externally
  React.useEffect(() => {
    if (initialValue !== state.selectedValue) {
      if (initialValue === null) {
        handleClear();
      } else if (typeof initialValue === 'string') {
        // Validate that the value exists in options
        const isValidOption = options.some(option => option.value === initialValue);
        if (isValidOption) {
          handleSelect(initialValue);
        } else {
          console.warn(`Invalid initialValue "${initialValue}" not found in options`);
          handleClear();
        }
      }
    }
  }, [initialValue, state.selectedValue, handleSelect, handleClear, options]);

  // Create a memoized onChange handler to prevent unnecessary re-renders
  const handleChange = React.useCallback((value: string) => {
    handleSelect(value);
  }, [handleSelect]);

  // Handle clear selection with validation
  const handleClearSelection = React.useCallback(() => {
    handleClear();
  }, [handleClear]);

  // Handle search with debouncing if needed
  const handleSearch = React.useCallback((term: string) => {
    handleSearchChange(term);
  }, [handleSearchChange]);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium mb-1 block">
          {label}
        </label>
        
        {/* Controlled Combobox component */}
        <Combobox
          id={id}
          options={options}
          selectedValue={state.selectedValue}
          open={state.isOpen}
          searchTerm={state.searchTerm}
          placeholder={placeholder}
          onChange={handleChange}
          onClear={handleClearSelection}
          onOpenChange={handleOpenChange}
          onSearchChange={handleSearch}
          disabled={disabled}
          showClearButton={!!state.selectedValue}
        />
      </div>

      {/* State display (for demonstration) */}
      <div className="text-sm">
        <h4 className="font-medium mb-1">Current State:</h4>
        <div className="grid grid-cols-2 gap-2 bg-muted p-2 rounded-md">
          <div>Selected value:</div>
          <div>{state.selectedValue ? <Badge>{state.selectedValue}</Badge> : <em className="text-muted-foreground">None</em>}</div>
          
          <div>Dropdown open:</div>
          <div>{state.isOpen ? 'Yes' : 'No'}</div>
          
          <div>Search term:</div>
          <div>{state.searchTerm ? `&quot;${state.searchTerm}&quot;` : <em className="text-muted-foreground">Empty</em>}</div>
          
          <div>Status:</div>
          <div>{disabled ? <Badge variant="outline">Disabled</Badge> : <Badge variant="outline">Enabled</Badge>}</div>
        </div>
      </div>

      {/* Control buttons (for demonstration) */}
      <div className="flex flex-wrap gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => handleOpenChange(!state.isOpen)}
          disabled={disabled}
        >
          {state.isOpen ? 'Close Dropdown' : 'Open Dropdown'}
        </Button>
        
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleClear}
          disabled={!state.selectedValue || disabled}
        >
          Clear Selection
        </Button>
        
        <Button 
          size="sm" 
          variant="outline" 
          onClick={resetState}
          disabled={disabled}
        >
          Reset
        </Button>
        
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => handleSearchChange('a')}
          disabled={disabled}
        >
          Set Search: &quot;a&quot;
        </Button>
        
        <Button
          size="sm"
          variant={disabled ? "default" : "outline"}
          onClick={() => {
            /* This would typically connect to app state to toggle disabled state */
            alert('To toggle disabled state, you would need to connect this to your application state.');
          }}
        >
          {disabled ? 'Enable' : 'Disable'} Combobox
        </Button>
      </div>
    </div>
  )
} 