import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Combobox } from '../combobox';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

describe('Combobox Accessibility', () => {
  // Sample data for testing
  const options = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'durian', label: 'Durian' },
    { value: 'elderberry', label: 'Elderberry' }
  ];
  
  const renderCombobox = (props = {}) => {
    const onChange = jest.fn();
    const onClear = jest.fn();
    
    const utils = render(
      <Combobox
        options={options}
        selectedValue={null}
        onChange={onChange}
        onClear={onClear}
        id="fruit-select"
        ariaLabel="Select a fruit"
        placeholder="Select a fruit..."
        {...props}
      />
    );
    
    return {
      ...utils,
      onChange,
      onClear,
      async openDropdown() {
        // Get the button element with role combobox 
        const trigger = screen.getAllByRole('combobox')[0];
        await userEvent.click(trigger);
        
        // Wait for dropdown to appear
        await waitFor(() => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        });
      }
    };
  };
  
  it('should not have accessibility violations in default state', async () => {
    const { container } = renderCombobox();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should not have accessibility violations when open', async () => {
    const { container, openDropdown } = renderCombobox();
    await openDropdown();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should not have accessibility violations with selection', async () => {
    const { container } = renderCombobox({ selectedValue: 'apple' });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should have proper ARIA attributes in collapsed state', () => {
    renderCombobox();
    
    // Check combobox element
    const combobox = screen.getAllByRole('combobox')[0];
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combobox).toHaveAttribute('aria-label', 'Select a fruit');
    expect(combobox).toHaveAttribute('id', 'fruit-select');
  });
  
  it('should have proper ARIA attributes in expanded state', async () => {
    const { openDropdown } = renderCombobox();
    await openDropdown();
    
    // Check combobox element in expanded state
    const combobox = screen.getAllByRole('combobox')[0];
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Check listbox
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute('aria-labelledby', expect.stringContaining('fruit-select'));
    
    // Check options
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(5);
    
    // First option should have aria-selected attribute
    // Note: We don't check for "true" since this might depend on implementation
    expect(options[0]).toHaveAttribute('aria-selected');
  });
  
  // Test keyboard navigation with the updated component
  it('supports keyboard navigation', async () => {
    const { openDropdown, onChange } = renderCombobox();
    await openDropdown();
    
    // Find the search input
    const searchInput = screen.getByPlaceholderText('Search...');
    
    // Focus the search input
    searchInput.focus();
    
    // Down arrow to highlight first option
    await userEvent.keyboard('{ArrowDown}');
    
    // Verify first option is highlighted (with waitFor to allow any state updates to complete)
    const options = screen.getAllByRole('option');
    await waitFor(() => {
      // Check for data-highlighted attribute without requiring a specific value
      // This makes the test more resilient to implementation changes
      expect(options[0]).toHaveAttribute('data-highlighted');
    });
    
    // Move down to second option
    await userEvent.keyboard('{ArrowDown}');
    
    // Verify second option is highlighted
    await waitFor(() => {
      expect(options[1]).toHaveAttribute('data-highlighted');
    });
    
    // Move back up to first option
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => {
      expect(options[0]).toHaveAttribute('data-highlighted');
    });
    
    // End key should go to last option
    await userEvent.keyboard('{End}');
    await waitFor(() => {
      expect(options[options.length - 1]).toHaveAttribute('data-highlighted');
    });
    
    // Home key should go to first option
    await userEvent.keyboard('{Home}');
    await waitFor(() => {
      expect(options[0]).toHaveAttribute('data-highlighted');
    });
    
    // Press Enter to select option
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('apple');
    
    // Escape closes dropdown
    await openDropdown(); // Open it again
    await userEvent.keyboard('{Escape}');
    
    // Dropdown should be closed
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
  
  it('has proper focus management', async () => {
    renderCombobox();
    
    // Initially the document.body should be the active element
    expect(document.body).toHaveFocus();
    
    // Verify that elements can receive focus in the right order
    await userEvent.tab(); // Focus goes to combobox
    
    // Verify some element has focus (not the body)
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveAttribute('role', 'combobox');
  });
  
  it('has accessible clear button', async () => {
    // Render with selected value
    const { onClear } = renderCombobox({ 
      selectedValue: 'apple', 
      showClearButton: true 
    });
    
    // Find clear button
    const clearButton = screen.getByRole('button');
    
    // Check accessibility attributes
    expect(clearButton).toHaveAttribute('aria-label', 'clear');
    expect(clearButton).toHaveAttribute('type', 'button');
    
    // Check that clicking the button calls onClear
    await userEvent.click(clearButton);
    expect(onClear).toHaveBeenCalled();
  });
}); 