'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn, filterComboboxOptions } from '@/lib/utils'
import { Button } from '@/components/ui'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui'

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
  
  // Always call useId unconditionally to comply with Rules of Hooks
  const generatedId = React.useId()
  const componentId = id || generatedId
  const listboxId = `${componentId}-listbox`
  
  // Find the selected option
  const selectedOption = React.useMemo(() => {
    if (selectedValue === null || selectedValue === undefined) return undefined
    const found = options.find((option) => option.value === selectedValue);
    
    return found;
  }, [selectedValue, options])

  // Filter options based on search text
  const filteredOptions = React.useMemo(() => {
    return filterComboboxOptions(options, search, filterMode, caseSensitive)
  }, [options, search, filterMode, caseSensitive])

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1)
  }, [filteredOptions])

  // Virtualization optimization
  const [visibleStartIndex, setVisibleStartIndex] = React.useState(0);
  const [visibleEndIndex, setVisibleEndIndex] = React.useState(Math.min(50, filteredOptions.length));
  const itemHeight = 41; // Height of each option item in pixels (based on px-4 py-2.5 and text-sm)
  
  // Performance optimization for large lists
  const visibleOptions = React.useMemo(() => {
    // If we have a reasonable number of options, don't virtualize to avoid complexity
    if (filteredOptions.length <= 100) {
      return filteredOptions;
    }
    
    // For large lists, only render the visible portion plus buffer for smooth scrolling
    const buffer = 10; // Extra items to render before and after visible range
    const start = Math.max(0, visibleStartIndex - buffer);
    const end = Math.min(filteredOptions.length, visibleEndIndex + buffer);
    
    return filteredOptions.slice(start, end);
  }, [filteredOptions, visibleStartIndex, visibleEndIndex]);

  // Handle scroll events to update visible range
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (filteredOptions.length <= 100) return; // Skip virtualization for smaller lists
    
    const scrollTop = e.currentTarget.scrollTop;
    const viewportHeight = e.currentTarget.clientHeight;
    
    const newStartIndex = Math.floor(scrollTop / itemHeight);
    const newEndIndex = Math.min(
      filteredOptions.length,
      Math.ceil((scrollTop + viewportHeight) / itemHeight)
    );
    
    if (newStartIndex !== visibleStartIndex || newEndIndex !== visibleEndIndex) {
      setVisibleStartIndex(newStartIndex);
      setVisibleEndIndex(newEndIndex);
    }
  }, [filteredOptions.length, itemHeight, visibleStartIndex, visibleEndIndex]);

  // Scroll to selected item when dropdown opens
  React.useEffect(() => {
    if (open && selectedValue && listRef.current) {
      const selectedIndex = filteredOptions.findIndex(option => option.value === selectedValue);
      if (selectedIndex >= 0) {
        // Use setTimeout to ensure the dropdown has fully opened
        setTimeout(() => {
          const selectedElement = listRef.current?.querySelector(`[id="${componentId}-option-${selectedValue}"]`) as HTMLElement;
          if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 50);
      }
    }
  }, [open, selectedValue, filteredOptions, componentId]);

  // Improved scroll highlighted option into view with smoother behavior
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current && open) {
      const listItems = listRef.current.querySelectorAll('[cmdk-item]')
      if (listItems.length > highlightedIndex) {
        const highlightedItem = listItems[highlightedIndex] as HTMLElement
        if (highlightedItem) {
          highlightedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          
          // Update virtualization indices if we're using virtualization
          if (filteredOptions.length > 100) {
            const itemIndex = Array.from(listItems).indexOf(highlightedItem);
            const newStartIndex = Math.max(0, itemIndex - 5);
            const newEndIndex = Math.min(filteredOptions.length, itemIndex + 10);
            setVisibleStartIndex(newStartIndex);
            setVisibleEndIndex(newEndIndex);
          }
        }
      }
    }
  }, [highlightedIndex, open, filteredOptions.length]);

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
              // Break if we've cycled through all options or no options
              if (next === prev || filteredOptions.length === 0) break
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
              // Break if we've cycled through all options or no options
              if (next === prev || filteredOptions.length === 0) break
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
        case 'Tab':
          // Allow Tab to navigate between options when dropdown is open
          if (open && filteredOptions.length > 0) {
            e.preventDefault();
            setHighlightedIndex(prev => {
              const direction = e.shiftKey ? -1 : 1;
              let newIndex = (prev + direction) % filteredOptions.length;
              if (newIndex < 0) newIndex = filteredOptions.length - 1;
              return newIndex;
            });
          }
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

  // Add a focus style utility
  const getFocusStyles = React.useCallback(() => {
    return open ? 'ring-2 ring-teal-500/20 border-teal-500' : '';
  }, [open]);

  return (
    <div className="relative w-full">
      {/* Live region for screen reader announcements */}
      <div 
        id={`${componentId}-live`}
        aria-live="polite" 
        className="sr-only"
        role="status"
      />
      
      <Popover open={open} onOpenChange={handleOpenChange}>
        <div className="flex items-center w-full">
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
              className={cn(
                'w-full justify-between', 
                'border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 font-medium',
                'bg-white dark:bg-gray-700',
                'hover:border-teal-400 dark:hover:border-gray-500 focus-visible:border-teal-500 dark:focus-visible:border-[#FDD964]',
                'transition-all duration-200',
                'shadow-sm h-10 sm:h-10',
                'text-sm sm:text-base',
                'px-3 py-2',
                getFocusStyles(),
                className
              )}
              disabled={disabled}
              id={componentId}
              data-state={open ? "open" : "closed"}
            >
              <span className="truncate">
                {selectedOption?.label ? (
                  <span className="text-gray-900 dark:text-gray-100">{selectedOption.label}</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
                )}
              </span>
              <ChevronsUpDown className={cn(
                "ml-2 h-4 w-4 shrink-0 transition-transform duration-200",
                open ? "rotate-180 opacity-100" : "opacity-60"
              )} />
            </Button>
          </PopoverTrigger>
          
          {showClearButton && selectedValue && onClear && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="ml-1 h-9 w-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors sm:h-10 sm:w-10"
              type="button"
              aria-label="clear"
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
          className={cn(
            "p-0 border border-gray-200 shadow-lg",
            "rounded-md overflow-hidden",
            "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=top]:slide-in-from-bottom-2",
            "w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)]"
          )} 
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          onKeyDown={handleKeyDown}
          id={listboxId}
          role="region"
          aria-labelledby={componentId}
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <div className="flex items-center border-b border-gray-200 px-3">
              <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput 
                placeholder={searchPlaceholder} 
                value={search}
                onValueChange={handleSearchChange}
                className={cn(
                  "h-10 flex-1",
                  "border-0 border-none",
                  "bg-transparent text-gray-800",
                  "focus:ring-0 focus:outline-none",
                  "placeholder:text-gray-400"
                )}
                ref={inputRef}
                aria-autocomplete="list"
                aria-controls={`${componentId}-options`}
                aria-activedescendant={
                  highlightedIndex >= 0 
                    ? `${componentId}-option-${filteredOptions[highlightedIndex]?.value}`
                    : undefined
                }
                onKeyDown={(e) => {
                  // Override default CommandInput tab behavior
                  if (e.key === 'Tab' && open && highlightedIndex >= 0) {
                    e.preventDefault();
                    // Move to next/previous option based on shift key
                    setHighlightedIndex(prev => {
                      if (e.shiftKey) {
                        // Move up (or to last item if at first)
                        return prev <= 0 ? filteredOptions.length - 1 : prev - 1;
                      } else {
                        // Move down (or to first item if at last)
                        return (prev + 1) % filteredOptions.length;
                      }
                    });
                  }
                }}
              />
            </div>
            <CommandList 
              style={{ maxHeight }} 
              ref={listRef}
              id={`${componentId}-options`}
              role="listbox"
              aria-labelledby={componentId}
              aria-multiselectable="false"
              className="custom-scrollbar max-h-[300px] overflow-y-auto"
              onScroll={handleScroll}
              onKeyDown={(e) => {
                // Handle tab key for keyboard navigation
                if (e.key === 'Tab') {
                  e.stopPropagation(); // Prevent bubbling to parent handlers
                }
              }}
            >
              {filteredOptions.length === 0 ? (
                <CommandEmpty role="status" className="py-3 px-4 text-sm text-gray-500 text-center">
                  {emptyMessage}
                </CommandEmpty>
              ) : (
                <CommandGroup>
                  {/* Add spacer at the top for virtualized lists */}
                  {filteredOptions.length > 100 && visibleStartIndex > 0 && (
                    <div 
                      style={{ 
                        height: visibleStartIndex * itemHeight, 
                        width: '100%' 
                      }} 
                      aria-hidden="true"
                    />
                  )}
                  
                  {(filteredOptions.length <= 100 ? filteredOptions : visibleOptions).map((option, index) => {
                    // Adjust index for virtualized rendering
                    const actualIndex = filteredOptions.length <= 100 
                      ? index 
                      : index + Math.max(0, visibleStartIndex - 10);
                    
                    const isHighlighted = actualIndex === highlightedIndex;
                    const isSelected = selectedValue === option.value;
                    
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={(value) => {
                          if (!option.disabled) {
                            // Restore original logic
                            onChange(value) 
                            handleOpenChange(false)
                            handleSearchChange('')
                            setTimeout(() => buttonRef.current?.focus(), 0)
                          }
                        }}
                        onMouseEnter={() => !option.disabled && setHighlightedIndex(actualIndex)}
                        onMouseDown={(e) => {
                          // Prevent default to avoid losing focus on the input
                          e.preventDefault();
                        }}
                        aria-selected={isHighlighted}
                        data-highlighted={isHighlighted}
                        className={cn(
                          "px-4 py-2.5 cursor-pointer text-sm",
                          "text-gray-900 dark:text-gray-100",
                          "aria-selected:bg-accent aria-selected:text-accent-foreground",
                          "data-[highlighted=true]:bg-teal-50 dark:data-[highlighted=true]:bg-gray-700 data-[highlighted=true]:text-teal-700 dark:data-[highlighted=true]:text-gray-100",
                          "hover:bg-teal-50 dark:hover:bg-gray-700 hover:text-teal-700 dark:hover:text-gray-100",
                          "focus:bg-teal-50 dark:focus:bg-gray-700 focus:text-teal-700 dark:focus:text-gray-100",
                          "focus:outline-none",
                          "transition-colors duration-150",
                       
                          isHighlighted && "bg-teal-50 dark:bg-gray-700 text-teal-700 dark:text-gray-100",
                          option.disabled && "opacity-50 pointer-events-none text-gray-400"
                        )}
                        role="option"
                        aria-label={option.label}
                        aria-disabled={option.disabled}
                        id={`${componentId}-option-${option.value}`}
                        tabIndex={-1}
                      >
                        <div className="flex items-center">
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4 text-teal-600 flex-shrink-0',
                              isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{option.label}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                  
                  {/* Add spacer at the bottom for virtualized lists */}
                  {filteredOptions.length > 100 && visibleEndIndex < filteredOptions.length && (
                    <div 
                      style={{ 
                        height: (filteredOptions.length - visibleEndIndex) * itemHeight, 
                        width: '100%' 
                      }} 
                      aria-hidden="true"
                    />
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
} 