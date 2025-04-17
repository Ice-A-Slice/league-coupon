'use client'

import * as React from 'react'
import { CheckIcon, ChevronsUpDown } from "lucide-react"

import { cn, filterComboboxOptions } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface ComboboxOption {
  value: string
  label: string
  /** Optional disabled state for this option */
  disabled?: boolean
}

export interface ComboboxProps {
  /** Array of options to display in the dropdown */
  options: ComboboxOption[]
  /** Currently selected value */
  selectedValue?: string | null
  /** Callback for when selection changes */
  onChange: (value: string) => void
  /** Optional callback for when clear option is selected */
  onClear?: () => void
  /** Placeholder text when no option is selected */
  placeholder?: string
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Additional classes to apply to the combobox button */
  className?: string
  /** Message to display when no options match the search */
  emptyMessage?: string
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Maximum height of the dropdown in pixels */
  maxHeight?: number
  /**
   * Filter mode determines how search matching is performed
   * 'contains' - Default. Matches any part of the text
   * 'startsWith' - Matches the beginning of the text
   * 'fuzzy' - Fuzzy matching that handles typos and partial matches
   */
  filterMode?: 'contains' | 'startsWith' | 'fuzzy'
  /** Case sensitivity for filtering */
  caseSensitive?: boolean
  /** ID for the combo box for accessibility */
  id?: string
  /** Accessible label for the combobox */
  ariaLabel?: string
  /** ID of element that labels this combobox */
  ariaLabelledby?: string
  /** ID of element that describes this combobox */
  ariaDescribedby?: string
  /** Callback fired when the dropdown opens or closes */
  onOpenChange?: (open: boolean) => void
  /** Whether to show a clear button when a value is selected */
  showClearButton?: boolean
  /** Current search term (for controlled search input) */
  searchTerm?: string
  /** Callback for when search term changes */
  onSearchChange?: (term: string) => void
  /** Whether the dropdown is open (for controlled open state) */
  open?: boolean
}

/**
 * Accessible Combobox component with keyboard navigation support.
 * 
 * Accessibility features:
 * - Proper ARIA attributes for screen reader announcement
 * - Keyboard navigation support
 * - Focus management
 * - Visible focus indicators
 * - Proper role attributes
 * 
 * Keyboard shortcuts:
 * - Down Arrow: Move to next option
 * - Up Arrow: Move to previous option
 * - Home: Move to first option
 * - End: Move to last option
 * - Enter: Select focused option
 * - Escape: Close dropdown
 * - Tab: Move focus out of component
 * 
 * @example
 * ```tsx
 * <Combobox
 *   options={[
 *     { value: "apple", label: "Apple" },
 *     { value: "banana", label: "Banana" },
 *   ]}
 *   selectedValue={fruit}
 *   onChange={setFruit}
 *   ariaLabel="Select a fruit"
 *   id="fruit-select"
 * />
 * ```
 */
export function Combobox({
  options,
  selectedValue,
  onChange,
  onClear,
  placeholder = 'Select an option',
  disabled = false,
  className,
  emptyMessage = 'No results found.',
  searchPlaceholder = 'Search...',
  maxHeight = 300,
  filterMode = 'contains',
  caseSensitive = false,
  id,
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
  onOpenChange,
  showClearButton = false,
  searchTerm: externalSearchTerm,
  onSearchChange,
  open: externalOpen,
}: ComboboxProps) {
  // Internal state that will be used if not provided externally
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [internalSearch, setInternalSearch] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1)
  
  // Determine if we're in controlled or uncontrolled mode
  const isOpenControlled = externalOpen !== undefined
  const isSearchControlled = externalSearchTerm !== undefined
  
  // Use either controlled or internal state
  const open = isOpenControlled ? externalOpen : internalOpen
  const search = isSearchControlled ? externalSearchTerm : internalSearch

  // Refs
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const componentId = id || React.useId()
  const listboxId = `${componentId}-listbox`
  const labelId = `${componentId}-label`
  
  // Find the selected option
  const selectedOption = React.useMemo(() => {
    if (selectedValue === null || selectedValue === undefined) return undefined
    return options.find((option) => option.value === selectedValue)
  }, [selectedValue, options])

  // Filter options based on search text
  const filteredOptions = React.useMemo(() => {
    return filterComboboxOptions(options, search, filterMode, caseSensitive)
  }, [options, search, filterMode, caseSensitive])

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1)
  }, [filteredOptions])

  // Scroll highlighted option into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const listItems = listRef.current.querySelectorAll('[cmdk-item]')
      if (listItems.length > highlightedIndex) {
        const highlightedItem = listItems[highlightedIndex] as HTMLElement
        if (highlightedItem) {
          highlightedItem.scrollIntoView({ block: 'nearest' })
        }
      }
    }
  }, [highlightedIndex])
  
  // Handle search change - defined BEFORE it's used in handleKeyDown
  const handleSearchChange = React.useCallback((value: string) => {
    if (!isSearchControlled) {
      setInternalSearch(value)
    }
    
    if (onSearchChange) {
      onSearchChange(value)
    }
  }, [isSearchControlled, onSearchChange])

  // Handle dropdown open/close - defined BEFORE it's used in handleKeyDown
  const handleOpenChange = React.useCallback((isOpen: boolean) => {
    if (!isOpenControlled) {
      setInternalOpen(isOpen)
    }
    
    if (!isOpen) {
      setHighlightedIndex(-1)
      handleSearchChange('')
    }
    
    // Call external handler if provided
    if (onOpenChange) {
      onOpenChange(isOpen)
    }
    
    // Announce state change to screen readers via aria-live
    if (isOpen) {
      const liveRegion = document.getElementById(`${componentId}-live`)
      if (liveRegion) {
        liveRegion.textContent = `Dropdown opened. ${filteredOptions.length} options available.`
      }
    }
  }, [isOpenControlled, componentId, filteredOptions.length, onOpenChange, handleSearchChange])

  // Handle clear button click
  const handleClear = React.useCallback(() => {
    if (onClear) {
      onClear()
    }
  }, [onClear])
  
  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(prev => {
            // Find the next non-disabled option
            let next = prev
            do {
              next = (next + 1) % filteredOptions.length
              // Break if we've cycled through all options
              if (next === prev) break
            } while (filteredOptions[next]?.disabled)
            
            return next
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(prev => {
            // Find the previous non-disabled option
            let next = prev
            do {
              next = next <= 0 ? filteredOptions.length - 1 : next - 1
              // Break if we've cycled through all options
              if (next === prev) break
            } while (filteredOptions[next]?.disabled)
            
            return next
          })
          break
        case 'Home':
          e.preventDefault()
          // Find first non-disabled option
          for (let i = 0; i < filteredOptions.length; i++) {
            if (!filteredOptions[i].disabled) {
              setHighlightedIndex(i)
              break
            }
          }
          break
        case 'End':
          e.preventDefault()
          // Find last non-disabled option
          for (let i = filteredOptions.length - 1; i >= 0; i--) {
            if (!filteredOptions[i].disabled) {
              setHighlightedIndex(i)
              break
            }
          }
          break
        case 'Enter':
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            const option = filteredOptions[highlightedIndex]
            if (!option.disabled) {
              onChange(option.value)
              handleOpenChange(false)
              handleSearchChange('')
              // Move focus back to trigger button after selection
              setTimeout(() => buttonRef.current?.focus(), 0)
            }
          }
          break
        case 'Escape':
          e.preventDefault()
          handleOpenChange(false)
          // Move focus back to trigger button
          setTimeout(() => buttonRef.current?.focus(), 0)
          break
        // Type-ahead functionality
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Find the first option that starts with the pressed key
            const key = e.key.toLowerCase()
            const matchIndex = filteredOptions.findIndex(option => 
              !option.disabled && option.label.toLowerCase().startsWith(key)
            )
            
            if (matchIndex >= 0) {
              setHighlightedIndex(matchIndex)
            }
          }
          break
      }
    },
    [open, filteredOptions, highlightedIndex, onChange, handleOpenChange, handleSearchChange]
  )

  // Focus input when dropdown is opened
  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  return (
    <div className="relative">
      {/* Live region for screen reader announcements */}
      <div 
        id={`${componentId}-live`}
        aria-live="polite" 
        className="sr-only"
        role="status"
      />
      
      <Popover open={open} onOpenChange={handleOpenChange}>
        <div className="flex items-center">
          <PopoverTrigger asChild className="flex-1">
            <Button
              ref={buttonRef}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-haspopup="listbox"
              aria-label={ariaLabel || placeholder}
              aria-labelledby={ariaLabelledby}
              aria-describedby={ariaDescribedby}
              aria-autocomplete="list"
              className={cn('w-full justify-between', className)}
              disabled={disabled}
              id={componentId}
              data-state={open ? "open" : "closed"}
            >
              {selectedOption?.label || placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          
          {showClearButton && selectedValue && onClear && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="ml-1 h-9 w-9"
              type="button"
              aria-label="Clear selection"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          )}
        </div>
        
        <PopoverContent 
          className="p-0" 
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          onKeyDown={handleKeyDown}
          id={listboxId}
          role="region"
          aria-labelledby={componentId}
        >
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={searchPlaceholder} 
              value={search}
              onValueChange={handleSearchChange}
              className="h-9"
              ref={inputRef}
              aria-autocomplete="list"
              aria-controls={`${componentId}-options`}
              aria-activedescendant={
                highlightedIndex >= 0 
                  ? `${componentId}-option-${filteredOptions[highlightedIndex]?.value}`
                  : undefined
              }
            />
            <CommandList 
              style={{ maxHeight }} 
              ref={listRef}
              id={`${componentId}-options`}
              role="listbox"
              aria-labelledby={componentId}
              aria-multiselectable="false"
            >
              {filteredOptions.length === 0 ? (
                <CommandEmpty role="status">{emptyMessage}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option, index) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(value) => {
                        if (!option.disabled) {
                          onChange(value)
                          handleOpenChange(false)
                          handleSearchChange('')
                          // Move focus back to trigger button after selection
                          setTimeout(() => buttonRef.current?.focus(), 0)
                        }
                      }}
                      onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                      aria-selected={index === highlightedIndex}
                      data-highlighted={index === highlightedIndex}
                      className={cn(
                        index === highlightedIndex && 'bg-accent text-accent-foreground',
                        option.disabled && 'opacity-50 pointer-events-none'
                      )}
                      role="option"
                      aria-label={option.label}
                      aria-disabled={option.disabled}
                      id={`${componentId}-option-${option.value}`}
                      tabIndex={-1}
                    >
                      <CheckIcon
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedValue === option.value ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden="true"
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
} 