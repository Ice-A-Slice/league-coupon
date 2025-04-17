import { renderHook, act } from '@testing-library/react';
import {
  comboboxReducer,
  initialComboboxState,
  setSelection,
  clearSelection,
  setOpenState,
  setSearchTerm,
  resetCombobox,
  useComboboxState,
  ComboboxAction
} from '../combobox-state';

describe('Combobox Reducer', () => {
  it('should return the initial state', () => {
    expect(comboboxReducer(undefined, { type: 'unknown' } as ComboboxAction)).toEqual(initialComboboxState);
  });

  it('should handle SET_SELECTION', () => {
    const selectedValue = 'apple';
    const newState = comboboxReducer(initialComboboxState, setSelection(selectedValue));
    
    expect(newState).toEqual({
      ...initialComboboxState,
      selectedValue,
      isOpen: false,
      searchTerm: '',
    });
  });

  it('should handle CLEAR_SELECTION', () => {
    const startState = {
      ...initialComboboxState,
      selectedValue: 'apple',
    };
    
    const newState = comboboxReducer(startState, clearSelection());
    
    expect(newState).toEqual({
      ...startState,
      selectedValue: null,
    });
  });

  it('should handle SET_OPEN_STATE', () => {
    const isOpen = true;
    const newState = comboboxReducer(initialComboboxState, setOpenState(isOpen));
    
    expect(newState).toEqual({
      ...initialComboboxState,
      isOpen,
    });
  });

  it('should handle SET_SEARCH_TERM', () => {
    const searchTerm = 'app';
    const newState = comboboxReducer(initialComboboxState, setSearchTerm(searchTerm));
    
    expect(newState).toEqual({
      ...initialComboboxState,
      searchTerm,
    });
  });

  it('should handle RESET', () => {
    const startState = {
      selectedValue: 'apple',
      isOpen: true,
      searchTerm: 'app',
    };
    
    const newState = comboboxReducer(startState, resetCombobox());
    
    expect(newState).toEqual(initialComboboxState);
  });
});

describe('useComboboxState hook', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useComboboxState());
    
    expect(result.current.state).toEqual(initialComboboxState);
  });

  it('should initialize with provided initial value', () => {
    const initialValue = 'apple';
    const { result } = renderHook(() => useComboboxState({ 
      initialState: { selectedValue: initialValue }
    }));
    
    expect(result.current.state.selectedValue).toBe(initialValue);
  });

  it('should update selection and call onChange', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useComboboxState({ onChange }));
    
    act(() => {
      result.current.handleSelect('apple');
    });
    
    expect(result.current.state.selectedValue).toBe('apple');
    expect(onChange).toHaveBeenCalledWith('apple');
  });

  it('should clear selection and call onChange with null', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useComboboxState({
      initialState: { selectedValue: 'apple' },
      onChange,
    }));
    
    act(() => {
      result.current.handleClear();
    });
    
    expect(result.current.state.selectedValue).toBeNull();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('should update open state', () => {
    const { result } = renderHook(() => useComboboxState());
    
    act(() => {
      result.current.handleOpenChange(true);
    });
    
    expect(result.current.state.isOpen).toBe(true);
  });

  it('should update search term', () => {
    const { result } = renderHook(() => useComboboxState());
    
    act(() => {
      result.current.handleSearchChange('app');
    });
    
    expect(result.current.state.searchTerm).toBe('app');
  });

  it('should reset state', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useComboboxState({
      initialState: { selectedValue: 'apple' },
      onChange,
    }));
    
    // First change the state
    act(() => {
      result.current.handleSearchChange('app');
      result.current.handleOpenChange(true);
    });
    
    // Then reset it
    act(() => {
      result.current.resetState();
    });
    
    expect(result.current.state).toEqual(initialComboboxState);
    expect(onChange).toHaveBeenCalledWith(null);
  });
}); 