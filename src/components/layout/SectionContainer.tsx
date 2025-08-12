'use client';

import React, { useState, ReactNode } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * Props for the SectionContainer component
 * @typedef {Object} SectionContainerProps
 */
export interface SectionContainerProps {
  /** 
   * The title to display in the header.
   * This is required and will be displayed prominently in the section header.
   */
  title: string;
  
  /** 
   * Optional subtitle text to display below the title.
   * Useful for additional context or description.
   */
  subtitle?: string;
  
  /** 
   * Whether the section should be collapsible.
   * If true, the header will include a toggle button and be clickable to expand/collapse.
   * @default false
   */
  collapsible?: boolean;
  
  /** 
   * Whether the section should start collapsed (only applies if collapsible is true).
   * @default false
   */
  initialCollapsed?: boolean;
  
  /** 
   * The content to display in the section body.
   * This is the main content that will be shown or hidden based on the collapsed state.
   */
  children: ReactNode;
  
  /** 
   * Optional footer content to display at the bottom of the section.
   * Only shown when the section is expanded. Useful for notes or additional information.
   */
  footer?: ReactNode;
  
  /** 
   * Additional CSS classes to apply to the container.
   * Allows for customization of the overall container styling.
   * @default ''
   */
  className?: string;
  
  /** 
   * Additional CSS classes to apply to the header.
   * Allows for customization of the header styling.
   * @default ''
   */
  headerClassName?: string;
  
  /** 
   * Additional CSS classes to apply to the footer.
   * Allows for customization of the footer styling.
   * @default ''
   */
  footerClassName?: string;
  
  /** 
   * Optional callback when section is collapsed/expanded.
   * This is called whenever the collapsed state changes.
   */
  onToggleVisibility?: () => void;
  
  /** 
   * Optional aria-label for accessibility.
   * If provided, it will be applied to the section element.
   */
  'aria-label'?: string;
}

/**
 * A reusable container component for sections with consistent styling.
 * Features include a styled header with title/subtitle, optional collapsibility,
 * and an optional footer section.
 * 
 * @example
 * Basic usage:
 * ```tsx
 * <SectionContainer 
 *   title="Questions" 
 *   subtitle="Complete all questions for bonus points"
 * >
 *   <div className="p-4">Your content here</div>
 * </SectionContainer>
 * ```
 * 
 * @example
 * With collapsible behavior:
 * ```tsx
 * <SectionContainer 
 *   title="Match Results" 
 *   subtitle="View recent matches"
 *   collapsible={true}
 *   initialCollapsed={true}
 *   onToggleVisibility={() => console.log('Visibility toggled')}
 * >
 *   <div className="p-4">Match results content</div>
 * </SectionContainer>
 * ```
 * 
 * @example
 * With footer:
 * ```tsx
 * <SectionContainer 
 *   title="Betting Coupon" 
 *   subtitle="Select match outcomes"
 *   footer={<p className="text-sm">Odds are subject to change</p>}
 * >
 *   <div className="p-4">Betting options</div>
 * </SectionContainer>
 * ```
 */
const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  subtitle,
  collapsible = false,
  initialCollapsed = false,
  children,
  footer,
  className = '',
  headerClassName = '',
  footerClassName = '',
  onToggleVisibility,
  'aria-label': ariaLabel,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  // Handle toggle collapse functionality
  const handleToggleCollapse = () => {
    if (collapsible) {
      const newState = !isCollapsed;
      setIsCollapsed(newState);
      
      if (onToggleVisibility) {
        onToggleVisibility();
      }
    }
  };

  // Base container styles
  const containerBaseStyle = "w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700";
  
  // Header gradient background style
  const headerBaseStyle = `p-3 sm:p-4 bg-gradient-to-r from-teal-500 to-teal-600 dark:from-[#FDD964] dark:to-[#F5D03A] text-white dark:text-gray-900 flex justify-between items-center ${collapsible ? 'cursor-pointer' : ''}`;

  // Generate a stable ID based on the title for linking heading and section
  const sectionIdBase = title.replace(/\s+/g, '-').toLowerCase(); // Create a base ID from title
  const headingId = `heading-${sectionIdBase}`; // Unique ID for the heading
  const contentId = `content-${sectionIdBase}`; // Unique ID for the content area if collapsible

  return (
    <section
      className={`${containerBaseStyle} ${className}`}
      aria-labelledby={headingId}
      aria-label={ariaLabel}
    >
      {/* Header Section */}
      <div
        className={`${headerBaseStyle} ${headerClassName}`}
        onClick={handleToggleCollapse}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-controls={collapsible ? contentId : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleToggleCollapse();
          }
        }}
      >
        {/* Title and Subtitle */}
        <div className="flex-1 min-w-0 pr-2">
          <h2
            id={headingId}
            className="text-base sm:text-lg font-bold truncate"
          >
            {title}
          </h2>
          {subtitle && <p className="text-xs opacity-90 truncate">{subtitle}</p>}
        </div>

        {/* Collapse/Expand Button */}
        {collapsible && (
          <button
            type="button"
            className="focus:outline-none p-1 flex-shrink-0"
            aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={(e) => {
              e.stopPropagation(); // Prevent container's onClick from firing again
              handleToggleCollapse();
            }}
          >
            {isCollapsed ? (
              <ChevronDownIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white dark:text-gray-900" aria-hidden="true" />
            ) : (
              <ChevronUpIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white dark:text-gray-900" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Content Area */}
      {!isCollapsed && (
        <div 
          id={collapsible ? contentId : undefined} 
          className="w-full"
        >
          {children}
        </div>
      )}

      {/* Optional Footer */}
      {!isCollapsed && footer && (
        <div className={`bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 ${footerClassName}`}>
          {footer}
        </div>
      )}
    </section>
  );
};

export default SectionContainer; 