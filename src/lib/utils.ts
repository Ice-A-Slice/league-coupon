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
 * Normalizes text by replacing Nordic/special characters with ASCII equivalents.
 * This helps users search for players with special characters using regular letters.
 * 
 * @param text - The text to normalize
 * @returns Normalized text with special characters replaced
 * 
 * @example
 * normalizeText("Gyökeres") // Returns "Gyokeres"
 * normalizeText("Håland") // Returns "Haland"
 * normalizeText("Kjær") // Returns "Kjaer"
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[äåà]/gi, 'a')
    .replace(/[öø]/gi, 'o')
    .replace(/[éèë]/gi, 'e')
    .replace(/[ç]/gi, 'c')
    .replace(/[ñ]/gi, 'n')
    .replace(/[ü]/gi, 'u')
    .replace(/[ý]/gi, 'y')
    .replace(/[æ]/gi, 'ae')
    .replace(/[ß]/gi, 'ss')
    // Add more replacements as needed
    ;
}

/**
 * Filter an array of Combobox options based on a search term.
 * Allows filtering by 'contains', 'startsWith', or a simple 'fuzzy' match 
 * (checks if search term characters appear in the option label in the correct order).
 * 
 * Features special character normalization to help find players with Nordic/special characters:
 * - ö, ø → o (e.g., "Gyokeres" finds "Gyökeres")
 * - ä, å, à → a (e.g., "Haland" finds "Håland")
 * - é, è, ë → e
 * - æ → ae
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
 *   { value: '2', label: 'Gyökeres' },
 *   { value: '3', label: 'Håland' },
 *   { value: '4', label: 'Avocado' }
 * ];
 * 
 * filterComboboxOptions(options, 'gyokeres'); 
 * // Returns: [{ value: '2', label: 'Gyökeres' }] (matches ö with o)
 * 
 * filterComboboxOptions(options, 'haland'); 
 * // Returns: [{ value: '3', label: 'Håland' }] (matches å with a)
 * 
 * filterComboboxOptions(options, 'Ao', 'fuzzy'); 
 * // Returns: [{ value: '4', label: 'Avocado' }]
 */
export function filterComboboxOptions(
  options: ComboboxOption[],
  searchTerm: string,
  filterMode: 'contains' | 'startsWith' | 'fuzzy' = 'contains',
  caseSensitive = false
): ComboboxOption[] {
  if (!searchTerm) return options;
  
  return options.filter((option) => {
    // Normalize both the label and search term for special character matching
    let label = option.label;
    let term = searchTerm;
    
    if (!caseSensitive) {
      label = label.toLowerCase();
      term = term.toLowerCase();
    }
    
    // Apply character normalization (ö -> o, å -> a, etc.)
    const normalizedLabel = normalizeText(label);
    const normalizedTerm = normalizeText(term);
    
    // Function to check both original and normalized versions
    const checkMatch = (labelText: string, termText: string) => {
      switch (filterMode) {
        case 'startsWith':
          return labelText.startsWith(termText);
        case 'fuzzy':
          // Simple fuzzy search - check if all characters appear in order
          let labelIndex = 0;
          for (let searchIndex = 0; searchIndex < termText.length; searchIndex++) {
            const searchChar = termText[searchIndex];
            let found = false;
            
            while (labelIndex < labelText.length) {
              if (labelText[labelIndex] === searchChar) {
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
          return labelText.includes(termText);
      }
    };
    
    // Check original text first, then normalized versions
    return checkMatch(label, term) || 
           checkMatch(normalizedLabel, term) ||
           checkMatch(label, normalizedTerm) ||
           checkMatch(normalizedLabel, normalizedTerm);
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
