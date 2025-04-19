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
 * Filter an array of Combobox options based on a search term
 * 
 * @param options - The array of options to filter
 * @param searchTerm - The search term to filter by
 * @param filterMode - The filtering mode to use
 * @param caseSensitive - Whether to use case-sensitive filtering
 * @returns An array of filtered options
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
