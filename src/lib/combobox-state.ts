/**
 * Combobox State Management Interface
 * 
 * This module provides a reusable interface for managing Combobox state within a React component.
 * It implements a simple state management pattern with actions, reducers, and selectors.
 */

'use client'

import { ComboboxOption } from "@/components/ui/combobox";
import { useReducer, useCallback } from "react";

// State Types
export interface ComboboxState {
  /** Currently selected value */
  selectedValue: string | null
  /** Whether the dropdown is open */
  isOpen: boolean
  /** Current search term */
  searchTerm: string
}

export const initialComboboxState: ComboboxState = {
  selectedValue: null,
  isOpen: false,
  searchTerm: '',
};

// Action Types
export enum ComboboxActionType {
  SET_SELECTION = 'combobox/SET_SELECTION',
  CLEAR_SELECTION = 'combobox/CLEAR_SELECTION',
  SET_OPEN_STATE = 'combobox/SET_OPEN_STATE',
  SET_SEARCH_TERM = 'combobox/SET_SEARCH_TERM',
  RESET = 'combobox/RESET',
}

// Action Interfaces
interface SetSelectionAction {
  type: ComboboxActionType.SET_SELECTION;
  payload: string;
}

interface ClearSelectionAction {
  type: ComboboxActionType.CLEAR_SELECTION;
}

interface SetOpenStateAction {
  type: ComboboxActionType.SET_OPEN_STATE;
  payload: boolean;
}

interface SetSearchTermAction {
  type: ComboboxActionType.SET_SEARCH_TERM;
  payload: string;
}

interface ResetAction {
  type: ComboboxActionType.RESET;
}

export type ComboboxAction = 
  | SetSelectionAction
  | ClearSelectionAction
  | SetOpenStateAction
  | SetSearchTermAction
  | ResetAction;

// Action Creators
export const setSelection = (value: string): SetSelectionAction => ({
  type: ComboboxActionType.SET_SELECTION,
  payload: value,
});

export const clearSelection = (): ClearSelectionAction => ({
  type: ComboboxActionType.CLEAR_SELECTION,
});

export const setOpenState = (isOpen: boolean): SetOpenStateAction => ({
  type: ComboboxActionType.SET_OPEN_STATE,
  payload: isOpen,
});

export const setSearchTerm = (term: string): SetSearchTermAction => ({
  type: ComboboxActionType.SET_SEARCH_TERM,
  payload: term,
});

export const resetCombobox = (): ResetAction => ({
  type: ComboboxActionType.RESET,
});

// Reducer
export const comboboxReducer = (
  state: ComboboxState = initialComboboxState,
  action: ComboboxAction
): ComboboxState => {
  switch (action.type) {
    case ComboboxActionType.SET_SELECTION:
      return {
        ...state,
        selectedValue: action.payload,
        isOpen: false,
        searchTerm: '',
      };
    
    case ComboboxActionType.CLEAR_SELECTION:
      return {
        ...state,
        selectedValue: null,
      };
    
    case ComboboxActionType.SET_OPEN_STATE:
      return {
        ...state,
        isOpen: action.payload,
      };
    
    case ComboboxActionType.SET_SEARCH_TERM:
      return {
        ...state,
        searchTerm: action.payload,
      };
    
    case ComboboxActionType.RESET:
      return initialComboboxState;
    
    default:
      return state;
  }
};

// Selector Functions
export const getSelectedValue = (state: ComboboxState): string | null => state.selectedValue;
export const getIsOpen = (state: ComboboxState): boolean => state.isOpen;
export const getSearchTerm = (state: ComboboxState): string => state.searchTerm;

// Helper Functions
export const getSelectedOption = (
  state: ComboboxState,
  options: ComboboxOption[]
): ComboboxOption | undefined => {
  if (!state.selectedValue) return undefined;
  return options.find(option => option.value === state.selectedValue);
};

/**
 * Custom hook to manage Combobox state within a React component
 * 
 * This hook provides a simple interface for managing Combobox state
 * and integrating with the application's state management system.
 * 
 * @param initialValue - Optional initial selected value
 * @param onChange - Optional callback when selection changes
 * @returns An object containing state and action dispatchers
 * 
 * @example
 * ```tsx
 * const { 
 *   state, 
 *   handleSelect, 
 *   handleClear, 
 *   handleOpenChange, 
 *   handleSearchChange 
 * } = useComboboxState({ 
 *   initialValue: "apple", 
 *   onChange: (value) => console.log(value) 
 * });
 * ```
 */
export interface UseComboboxStateOptions {
  /** Initial state for the combobox */
  initialState?: Partial<ComboboxState>
  /** Optional callback when selection changes */
  onChange?: (value: string | null) => void
}

export interface UseComboboxStateReturn {
  state: ComboboxState;
  handleSelect: (value: string) => void;
  handleClear: () => void;
  handleOpenChange: (isOpen: boolean) => void;
  handleSearchChange: (term: string) => void;
  resetState: () => void;
}

/**
 * Hook to manage Combobox state in a controlled manner
 */
export function useComboboxState({ 
  initialState = {}, 
  onChange 
}: UseComboboxStateOptions = {}): UseComboboxStateReturn {
  // Set up state with default values
  const [state, dispatch] = useReducer(comboboxReducer, {
    ...initialComboboxState,
    ...initialState,
  });

  // Handle selection change
  const handleSelect = useCallback((value: string) => {
    dispatch(setSelection(value));
    // Call external onChange if provided
    if (onChange) {
      onChange(value);
    }
  }, [onChange]);

  // Handle clearing selection
  const handleClear = useCallback(() => {
    dispatch(clearSelection());
    // Call external onChange with null
    if (onChange) {
      onChange(null);
    }
  }, [onChange]);

  // Handle dropdown open state change
  const handleOpenChange = useCallback((isOpen: boolean) => {
    dispatch(setOpenState(isOpen));
    // Clear search term when dropdown is closed
    if (!isOpen) {
      dispatch(setSearchTerm(''));
    }
  }, []);

  // Handle search term change
  const handleSearchChange = useCallback((term: string) => {
    dispatch(setSearchTerm(term));
    // Open dropdown when search term changes
    if (term.length > 0) {
      dispatch(setOpenState(true));
    }
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    dispatch(resetCombobox());
    // Call external onChange with null since we're clearing selection
    if (onChange) {
      onChange(null);
    }
  }, [onChange]);

  return {
    state,
    handleSelect,
    handleClear,
    handleOpenChange,
    handleSearchChange,
    resetState,
  };
} 