import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { ComboboxOption } from "@/components/ui/combobox"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Debounce a function to avoid excessive calls.
 * 
 * @param func - The function to debounce
 * @param wait - The debounce wait time in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait = 300
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Filter an array of Combobox options based on a search term.
 * Allows filtering by 'contains', 'startsWith', or a simple 'fuzzy' match 
 * (checks if search term characters appear in the option label in the correct order).
 * 
 * @param {ComboboxOption[]} options - The array of options to filter (each object should have at least a `label` property).
 * @param {string} searchTerm - The search term to filter by.
 * @param {'contains' | 'startsWith' | 'fuzzy'} [filterMode='contains'] - The filtering mode:
 *   - 'contains': Default. Checks if the option label includes the search term.
 *   - 'startsWith': Checks if the option label begins with the search term.
 *   - 'fuzzy': Checks if all characters of the search term appear in the option label in the correct sequence, 
 *                though not necessarily contiguously. E.g., "brn" would match "Bournemouth".
 * @param {boolean} [caseSensitive=false] - Whether the filtering should be case-sensitive.
 * @returns {ComboboxOption[]} An array of filtered options matching the criteria.
 * 
 * @example
 * const options = [
 *   { value: '1', label: 'Apple' },
 *   { value: '2', label: 'Banana' },
 *   { value: '3', label: 'Apricot' },
 *   { value: '4', label: 'Avocado' }
 * ];
 * 
 * filterComboboxOptions(options, 'Ap'); 
 * // Returns: [{ value: '1', label: 'Apple' }, { value: '3', label: 'Apricot' }]
 * 
 * filterComboboxOptions(options, 'Ap', 'startsWith'); 
 * // Returns: [{ value: '1', label: 'Apple' }, { value: '3', label: 'Apricot' }]
 * 
 * filterComboboxOptions(options, 'Ao', 'fuzzy'); 
 * // Returns: [{ value: '4', label: 'Avocado' }]
 * 
 * filterComboboxOptions(options, 'apple', 'contains', true); 
 * // Returns: [] (because of case sensitivity)
 */
export function filterComboboxOptions(
  options: ComboboxOption[],
  searchTerm: string,
  filterMode: 'contains' | 'startsWith' | 'fuzzy' = 'contains',
  caseSensitive = false
): ComboboxOption[] {
  if (!searchTerm) return options;
  
  return options.filter((option) => {
    const label = caseSensitive ? option.label : option.label.toLowerCase();
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    switch (filterMode) {
      case 'startsWith':
        return label.startsWith(term);
      case 'fuzzy':
        // Simple fuzzy search - check if all characters appear in order
        let labelIndex = 0;
        for (let searchIndex = 0; searchIndex < term.length; searchIndex++) {
          const searchChar = term[searchIndex];
          let found = false;
          
          while (labelIndex < label.length) {
            if (label[labelIndex] === searchChar) {
              found = true;
              labelIndex++;
              break;
            }
            labelIndex++;
          }
          
          if (!found) return false;
        }
        return true;
      case 'contains':
      default:
        return label.includes(term);
    }
  });
}

/**
 * Calculates the time difference between two dates.
 *
 * @param date1 - The first date (Date object or ISO string).
 * @param date2 - The second date (Date object or ISO string).
 * @param unit - The unit for the returned difference ('hours', 'minutes', 'seconds', 'milliseconds'). Defaults to 'hours'.
 * @returns The difference between date2 and date1 in the specified unit.
 */
export function calculateTimeDifference(
  date1: Date | string,
  date2: Date | string,
  unit: 'hours' | 'minutes' | 'seconds' | 'milliseconds' = 'hours'
): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  const diffMilliseconds = d2.getTime() - d1.getTime();

  switch (unit) {
    case 'milliseconds':
      return diffMilliseconds;
    case 'seconds':
      return diffMilliseconds / 1000;
    case 'minutes':
      return diffMilliseconds / (1000 * 60);
    case 'hours':
    default:
      return diffMilliseconds / (1000 * 60 * 60);
  }
}
