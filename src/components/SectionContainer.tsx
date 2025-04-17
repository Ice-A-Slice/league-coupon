import React, { useState, ReactNode } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * Props for the SectionContainer component
 * @typedef {Object} SectionContainerProps
 */
export interface SectionContainerProps {
  /** The title to display in the header */
  title: string;
  
  /** Optional subtitle text to display below the title */
  subtitle?: string;
  
  /** Whether the section should be collapsible */
  collapsible?: boolean;
  
  /** Whether the section should start collapsed (only applies if collapsible is true) */
  initialCollapsed?: boolean;
  
  /** The content to display in the section */
  children: ReactNode;
  
  /** Optional footer content to display at the bottom of the section */
  footer?: ReactNode;
  
  /** Additional CSS classes to apply to the container */
  className?: string;
  
  /** Additional CSS classes to apply to the header */
  headerClassName?: string;
  
  /** Additional CSS classes to apply to the footer */
  footerClassName?: string;
  
  /** Optional callback when section is collapsed/expanded */
  onToggleVisibility?: () => void;
}

/**
 * A reusable container component for sections with consistent styling
 * 
 * @example
 * ```tsx
 * <SectionContainer 
 *   title="Questions" 
 *   subtitle="Complete all questions for bonus points" 
 *   collapsible={true}
 * >
 *   <div className="p-4">Your content here</div>
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
  const containerBaseStyle = "w-full bg-white rounded-lg overflow-hidden shadow-md border border-gray-200";
  
  // Header gradient background style
  const headerBaseStyle = `p-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white flex justify-between items-center ${collapsible ? 'cursor-pointer' : ''}`;

  return (
    <div className={`${containerBaseStyle} ${className}`}>
      {/* Header Section */}
      <div
        className={`${headerBaseStyle} ${headerClassName}`}
        onClick={handleToggleCollapse}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? !isCollapsed : undefined}
        aria-controls={collapsible ? `section-content-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleToggleCollapse();
          }
        }}
      >
        {/* Title and Subtitle */}
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-xs opacity-90">{subtitle}</p>}
        </div>

        {/* Collapse/Expand Button */}
        {collapsible && (
          <button
            type="button"
            className="focus:outline-none p-1"
            aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={(e) => {
              e.stopPropagation(); // Prevent container's onClick from firing again
              handleToggleCollapse();
            }}
          >
            {isCollapsed ? (
              <ChevronDownIcon className="h-6 w-6 text-white" aria-hidden="true" />
            ) : (
              <ChevronUpIcon className="h-6 w-6 text-white" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Content Area */}
      {!isCollapsed && (
        <div 
          id={collapsible ? `section-content-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined} 
          className="w-full"
        >
          {children}
        </div>
      )}

      {/* Optional Footer */}
      {!isCollapsed && footer && (
        <div className={`bg-gray-50 p-3 text-xs text-gray-500 border-t border-gray-200 ${footerClassName}`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default SectionContainer; 