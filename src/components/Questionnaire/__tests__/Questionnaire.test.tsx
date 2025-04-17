import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Questionnaire from '../Questionnaire';

// Mock data
const mockTeams = [
  { id: 1, name: 'Arsenal' },
  { id: 2, name: 'Chelsea' },
  { id: 3, name: 'Liverpool' },
  { id: 4, name: 'Manchester City' },
  { id: 5, name: 'Manchester United' },
  { id: 6, name: 'Tottenham Hotspur' }
];

const mockPlayers = [
  { id: 101, name: 'Harry Kane', teamId: 6 },
  { id: 102, name: 'Mohamed Salah', teamId: 3 },
  { id: 103, name: 'Erling Haaland', teamId: 4 },
  { id: 104, name: 'Bruno Fernandes', teamId: 5 },
  { id: 105, name: 'Bukayo Saka', teamId: 1 }
];

// Mock functions
const mockOnPredictionChange = jest.fn();
const mockOnToggleVisibility = jest.fn();

// Setup helper
const setupQuestionnaire = (props = {}) => {
  const ref = React.createRef<{ validatePredictions: () => boolean }>();
  
  const utils = render(
    <Questionnaire
      ref={ref}
      teams={mockTeams}
      players={mockPlayers}
      onPredictionChange={mockOnPredictionChange}
      onToggleVisibility={mockOnToggleVisibility}
      {...props}
    />
  );
  
  return {
    ...utils,
    ref,
    // Helper functions
    async openDropdown(labelText: string) {
      const label = screen.getByText(labelText);
      const dropdown = label.parentElement?.querySelector('[role="combobox"]');
      if (!dropdown) throw new Error(`Dropdown for "${labelText}" not found`);
      await userEvent.click(dropdown);
      
      // Wait for dropdown content to appear
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    },
    async selectOption(optionText: string) {
      const option = screen.getByText(optionText);
      await userEvent.click(option);
    },
    async typeInSearch(text: string) {
      // Find the search input after the dropdown is opened
      const searchInput = screen.getAllByRole('combobox')
        .find(el => el.tagName === 'INPUT');
      
      if (!searchInput) {
        throw new Error('Search input not found');
      }
      
      await userEvent.type(searchInput, text);
    }
  };
};

describe('Questionnaire Component with Combobox', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders all dropdown sections correctly', () => {
    render(
      <Questionnaire
        teams={mockTeams}
        players={mockPlayers}
      />
    );
    
    // Check if all sections are rendered
    expect(screen.getByText('1. Which team will win the league?')).toBeInTheDocument();
    expect(screen.getByText('2. Which team will finish in last place?')).toBeInTheDocument();
    expect(screen.getByText('3. Which team will have the best goal difference?')).toBeInTheDocument();
    expect(screen.getByText('4. Who will be the top scorer in the league?')).toBeInTheDocument();
    
    // Check dropdown placeholders
    const dropdowns = screen.getAllByRole('combobox');
    expect(dropdowns.length).toBe(4);
  });
  
  it('displays validation errors when form is submitted with empty values', async () => {
    const { ref } = setupQuestionnaire();
    
    // Trigger validation through ref within act
    await act(async () => {
      if (ref.current) {
        const isValid = ref.current.validatePredictions();
        expect(isValid).toBe(false);
      }
    });
    
    // Wait for error messages to appear
    await waitFor(() => {
      // Look for the p tags with error text inside
      const errorElements = document.querySelectorAll('.text-red-500');
      expect(errorElements.length).toBe(4);
      
      // Check that the error text contains the expected messages
      const errorTexts = Array.from(errorElements).map(el => el.textContent);
      expect(errorTexts).toContain('Please select a league winner');
      expect(errorTexts).toContain('Please select a team for last place');
      expect(errorTexts).toContain('Please select a team with best goal difference');
      expect(errorTexts).toContain('Please select a top scorer');
    });
  });
  
  it('selects a team from the league winner dropdown', async () => {
    const { openDropdown, selectOption } = setupQuestionnaire();
    
    // Open the league winner dropdown
    await openDropdown('1. Which team will win the league?');
    
    // Select Arsenal option
    await selectOption('Arsenal');
    
    // Check if onPredictionChange was called with the correct value
    expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      leagueWinner: 1
    }));
  });
  
  it('selects a player from the top scorer dropdown', async () => {
    const { openDropdown, selectOption } = setupQuestionnaire();
    
    // Open the top scorer dropdown
    await openDropdown('4. Who will be the top scorer in the league?');
    
    // Select Salah option
    await selectOption('Mohamed Salah');
    
    // Check if onPredictionChange was called with the correct value
    expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      topScorer: 102
    }));
  });
  
  it('filters options when typing in the search field', async () => {
    const { openDropdown, typeInSearch } = setupQuestionnaire();
    
    // Open the league winner dropdown
    await openDropdown('1. Which team will win the league?');
    
    // Use the helper function to find and type in the search input
    await typeInSearch('man');
    
    // Check if only Manchester teams are displayed
    await waitFor(() => {
      expect(screen.getByText('Manchester City')).toBeInTheDocument();
      expect(screen.getByText('Manchester United')).toBeInTheDocument();
      expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();
    });
  });
  
  it('handles keyboard navigation correctly', async () => {
    const { openDropdown } = setupQuestionnaire();
    
    // Open the league winner dropdown
    await openDropdown('1. Which team will win the league?');
    
    // Find all combobox role elements and get the input (not the button)
    const comboboxes = screen.getAllByRole('combobox');
    const searchInput = comboboxes.find(el => el.tagName === 'INPUT');
    expect(searchInput).toBeDefined();
    
    if (searchInput) {
      // Focus the input
      searchInput.focus();
      
      // Press arrow down to navigate options
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      
      // Press Enter to select the option (Liverpool, ID: 3)
      await userEvent.keyboard('{Enter}');
      
      // Check if onPredictionChange was called with the correct value
      await waitFor(() => {
        expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
          leagueWinner: 3
        }));
      });
    }
  });
  
  it('clears selected value when clear button is clicked', async () => {
    // Start with initial selections
    setupQuestionnaire({
      initialPredictions: {
        leagueWinner: 1,
        lastPlace: null,
        bestGoalDifference: null,
        topScorer: null
      }
    });
    
    // Verify Arsenal is selected
    expect(screen.getByText('Arsenal')).toBeInTheDocument();
    
    // Find and click the clear button (usually an X icon near selected value)
    const clearButton = screen.getByRole('button', { name: /clear/i });
    await userEvent.click(clearButton);
    
    // Check if onPredictionChange was called with null for leagueWinner
    expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      leagueWinner: null
    }));
  });
  
  it('validates form successfully when all fields are filled', async () => {
    const { ref } = setupQuestionnaire({
      initialPredictions: {
        leagueWinner: 1,
        lastPlace: 2,
        bestGoalDifference: 3,
        topScorer: 101
      }
    });
    
    // Trigger validation through ref within act
    await act(async () => {
      if (ref.current) {
        const isValid = ref.current.validatePredictions();
        expect(isValid).toBe(true);
      }
    });
    
    // Check that no error messages are displayed
    const errorElements = document.querySelectorAll('.text-red-500');
    expect(errorElements.length).toBe(0);
  });
  
  it('toggles content visibility when header is clicked', async () => {
    setupQuestionnaire();
    
    // Find and click the toggle button in the header
    const toggleButton = screen.getByRole('button', { name: /collapse questions/i });
    await userEvent.click(toggleButton);
    
    // Check if onToggleVisibility was called
    expect(mockOnToggleVisibility).toHaveBeenCalled();
  });
}); 