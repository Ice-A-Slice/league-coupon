import { useState, useCallback } from 'react';

/**
 * Custom hook for managing localStorage with type safety and error handling
 * @param key - The localStorage key to use
 * @param initialValue - The initial value if nothing is stored
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  // Function to remove the value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * Specialized hook for managing betting form data in localStorage
 */
export function useBettingFormStorage() {
  const [selections, setSelections, clearSelections] = useLocalStorage('betting-selections', {});
  const [predictions, setPredictions, clearPredictions] = useLocalStorage('betting-predictions', {
    leagueWinner: null,
    lastPlace: null,
    bestGoalDifference: null,
    topScorer: null
  });

  // Clear all form data
  const clearAllFormData = useCallback(() => {
    clearSelections();
    clearPredictions();
  }, [clearSelections, clearPredictions]);

  return {
    selections,
    setSelections,
    predictions,
    setPredictions,
    clearAllFormData
  };
} 