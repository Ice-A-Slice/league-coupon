import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Questionnaire from '../Questionnaire';
import type { Team, Player, Prediction } from '../types';
import { validatePrediction } from '@/schemas/questionnaireSchema';

// Mock data
const mockTeams: Team[] = [
  { id: '1', name: 'Arsenal' },
  { id: '2', name: 'Chelsea' },
  { id: '3', name: 'Liverpool' },
  { id: '4', name: 'Manchester City' },
  { id: '5', name: 'Manchester United' },
  { id: '6', name: 'Tottenham Hotspur' }
];

const mockPlayers: Player[] = [
  { id: '101', name: 'Harry Kane', teamId: '6' },
  { id: '102', name: 'Mohamed Salah', teamId: '3' },
  { id: '103', name: 'Erling Haaland', teamId: '4' },
  { id: '104', name: 'Bruno Fernandes', teamId: '5' },
  { id: '105', name: 'Bukayo Saka', teamId: '1' }
];

// Mock functions
const mockOnPredictionChange = jest.fn();
const mockOnToggleVisibility = jest.fn();

// Mock the schema validation
jest.mock('@/schemas/questionnaireSchema', () => ({
  validatePrediction: jest.fn()
}));

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
      
      // Use findByRole instead of waitFor with getByRole
      await screen.findByRole('listbox');
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
    // Default mock implementation for validatePrediction
    (validatePrediction as jest.Mock).mockImplementation((predictions) => {
      const hasNullValues = Object.values(predictions).some(value => value === null);
      if (hasNullValues) {
        return {
          isValid: false,
          errors: {
            ...(predictions.leagueWinner === null && { leagueWinner: 'League winner is required' }),
            ...(predictions.lastPlace === null && { lastPlace: 'Last place team is required' }),
            ...(predictions.bestGoalDifference === null && { bestGoalDifference: 'Best goal difference team is required' }),
            ...(predictions.topScorer === null && { topScorer: 'Top scorer is required' })
          }
        };
      }
      return { isValid: true };
    });
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
    
    // Check that validatePrediction from the schema was called
    expect(validatePrediction).toHaveBeenCalled();
    
    // Wait for error messages to appear
    await waitFor(() => {
      // Look for the p tags with error text inside
      const errorElements = document.querySelectorAll('.text-red-500');
      expect(errorElements.length).toBe(4);
      
      // Check that the error text contains the expected messages
      const errorTexts = Array.from(errorElements).map(el => el.textContent);
      expect(errorTexts).toContain('League winner is required');
      expect(errorTexts).toContain('Last place team is required');
      expect(errorTexts).toContain('Best goal difference team is required');
      expect(errorTexts).toContain('Top scorer is required');
    });
  });
  
  it('selects a team from the league winner dropdown', async () => {
    const { openDropdown, selectOption } = setupQuestionnaire();
    
    // Open the league winner dropdown
    await openDropdown('1. Which team will win the league?');
    
    // Select Arsenal option
    await selectOption('Arsenal');
    
    // Check if onPredictionChange was called with the correct value (string ID)
    expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      leagueWinner: '1'
    }));
  });
  
  it('selects a player from the top scorer dropdown', async () => {
    const { openDropdown, selectOption } = setupQuestionnaire();
    
    // Open the top scorer dropdown
    await openDropdown('4. Who will be the top scorer in the league?');
    
    // Select Salah option
    await selectOption('Mohamed Salah');
    
    // Check if onPredictionChange was called with the correct value (string ID)
    expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      topScorer: '102'
    }));
  });
  
  it('filters options when typing in the search field', async () => {
    const { openDropdown, typeInSearch } = setupQuestionnaire();
    
    // Open the league winner dropdown
    await openDropdown('1. Which team will win the league?');
    
    // Use the helper function to find and type in the search input
    await typeInSearch('man');
    
    // Check if only Manchester teams are displayed using findByText
    await screen.findByText('Manchester City');
    await screen.findByText('Manchester United');
    expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();
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
      const expectedCall = expect.objectContaining({
        leagueWinner: '3'
      });
      
      // Use waitFor correctly for checking function calls
      await waitFor(() => {
        expect(mockOnPredictionChange).toHaveBeenCalledWith(expectedCall);
      });
    }
  });
  
  it('clears selected value when clear button is clicked', async () => {
    // Start with initial selections (using string ID)
    setupQuestionnaire({
      initialPredictions: {
        leagueWinner: '1', // Use string ID
        lastPlace: null,
        bestGoalDifference: null,
        topScorer: null
      }
    });
    
    // Find the specific trigger button for league winner
    const leagueWinnerLabel = screen.getByText('1. Which team will win the league?');
    const leagueWinnerTrigger = leagueWinnerLabel.parentElement?.querySelector<HTMLButtonElement>('[role="combobox"]');
    expect(leagueWinnerTrigger).toBeInTheDocument();

    // Verify Arsenal is displayed in the trigger button
    expect(leagueWinnerTrigger).toHaveTextContent('Arsenal');
    
    // Find the clear button, which should be a sibling of the trigger
    const clearButton = leagueWinnerTrigger?.parentElement?.querySelector<HTMLButtonElement>('button[aria-label="clear"]');
    expect(clearButton).toBeInTheDocument(); // Ensure the button is found
    
    if (clearButton) { // Type guard
      await userEvent.click(clearButton);
    }
    
    // Check if onPredictionChange was called with null for leagueWinner
    expect(mockOnPredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      leagueWinner: null
    }));

    // Verify the placeholder is shown again using findByText
    await expect(leagueWinnerTrigger).toHaveTextContent(/Select league winner/i);
  });
  
  it('validates form successfully when all fields are filled', async () => {
    const { ref } = setupQuestionnaire({
      initialPredictions: {
        leagueWinner: '1',
        lastPlace: '2',
        bestGoalDifference: '3',
        topScorer: '101'
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
  
  // New tests for Zod validation
  describe('Zod Validation', () => {
    it('uses the Zod schema for validation', async () => {
      const { ref } = setupQuestionnaire();
      
      // Set up a custom mock for this test
      (validatePrediction as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: {
          leagueWinner: 'League winner must be a valid UUID',
        }
      });
      
      // Trigger validation
      await act(async () => {
        if (ref.current) {
          const isValid = ref.current.validatePredictions();
          expect(isValid).toBe(false);
        }
      });
      
      // Verify the schema validation was called
      expect(validatePrediction).toHaveBeenCalled();
      
      // Use findByText for async assertion
      await screen.findByText('League winner must be a valid UUID');
    });
    
    it('clears validation errors when a field is updated', async () => {
      const { ref, openDropdown, selectOption } = setupQuestionnaire();
      
      // First, trigger validation to show errors
      (validatePrediction as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: {
          leagueWinner: 'League winner is required',
          lastPlace: 'Last place team is required',
        }
      });
      
      await act(async () => {
        if (ref.current) {
          ref.current.validatePredictions();
        }
      });
      
      // Verify errors are displayed
      expect(screen.getByText('League winner is required')).toBeInTheDocument();
      
      // Now select a value for league winner
      await openDropdown('1. Which team will win the league?');
      await selectOption('Arsenal');
      
      // Verify the error for that field is cleared
      expect(screen.queryByText('League winner is required')).not.toBeInTheDocument();
      
      // But other field errors should remain
      expect(screen.getByText('Last place team is required')).toBeInTheDocument();
    });
    
    it('returns valid when all fields pass Zod validation', async () => {
      // Set up with all fields filled
      const { ref } = setupQuestionnaire({
        initialPredictions: {
          leagueWinner: '1',
          lastPlace: '2',
          bestGoalDifference: '3',
          topScorer: '101'
        }
      });
      
      // Mock validation to return valid
      (validatePrediction as jest.Mock).mockReturnValueOnce({
        isValid: true
      });
      
      // Trigger validation
      await act(async () => {
        if (ref.current) {
          const isValid = ref.current.validatePredictions();
          expect(isValid).toBe(true);
        }
      });
      
      // Verify the schema validation was called with the correct predictions
      expect(validatePrediction).toHaveBeenCalledWith({
        leagueWinner: '1',
        lastPlace: '2',
        bestGoalDifference: '3',
        topScorer: '101'
      });
      
      // No errors should be displayed
      expect(screen.queryByText('League winner is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Last place team is required')).not.toBeInTheDocument();
    });
  });
});

describe('Questionnaire', () => {
  it('renders all questions', () => {
    render(
      <Questionnaire 
        teams={mockTeams} 
        players={mockPlayers} 
      />
    );
    
    // Check that all questions are displayed
    expect(screen.getByText('1. Which team will win the league?')).toBeInTheDocument();
    expect(screen.getByText('2. Which team will finish in last place?')).toBeInTheDocument();
    expect(screen.getByText('3. Which team will have the best goal difference?')).toBeInTheDocument();
    expect(screen.getByText('4. Who will be the top scorer in the league?')).toBeInTheDocument();
  });
  
  it('calls onPredictionChange when a selection is made', async () => {
    const handlePredictionChange = jest.fn();
    
    const { openDropdown, selectOption } = setupQuestionnaire({
      onPredictionChange: handlePredictionChange
    });
    
    // Open the league winner dropdown
    await openDropdown('1. Which team will win the league?');
    
    // Select a team
    await selectOption('Arsenal');
    
    // Check that the callback was called with the expected data
    expect(handlePredictionChange).toHaveBeenCalledWith(expect.objectContaining({
      leagueWinner: '1'
    }));
  });
  
  it('validates predictions correctly', async () => {
    // Create a ref to access the validatePredictions method
    const ref = React.createRef<{validatePredictions: () => boolean}>();
    
    render(
      <Questionnaire
        ref={ref}
        teams={mockTeams}
        players={mockPlayers}
      />
    );
    
    // Test with no selections - wrap in act
    let validationResult;
    await act(async () => {
      validationResult = ref.current?.validatePredictions();
    });
    expect(validationResult).toBe(false);
    
    // Wait for errors to be rendered and check for them
    // Use queryAllByText to find all error message elements
    const errorMessages = screen.getAllByText(/is required$/i);
    expect(errorMessages.length).toBe(4); // One for each field
    
    // Verify each specific error message is included
    const errorTexts = errorMessages.map(el => el.textContent);
    expect(errorTexts).toContain('League winner is required');
    expect(errorTexts).toContain('Last place team is required');
    expect(errorTexts).toContain('Best goal difference team is required');
    expect(errorTexts).toContain('Top scorer is required');
  });
  
  it('validates with complete predictions as valid', async () => {
    // Create a ref to access the validatePredictions method
    const ref = React.createRef<{validatePredictions: () => boolean}>();
    
    const completePredictions: Prediction = {
      leagueWinner: '1',
      lastPlace: '2',
      bestGoalDifference: '3',
      topScorer: '101'
    };
    
    render(
      <Questionnaire
        ref={ref}
        teams={mockTeams}
        players={mockPlayers}
        initialPredictions={completePredictions}
      />
    );
    
    // Test with complete selections
    let validationResult;
    await act(async () => {
      validationResult = ref.current?.validatePredictions();
    });
    expect(validationResult).toBe(true);
    
    // No error messages should be displayed
    expect(screen.queryByText('League winner is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Last place team is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Best goal difference team is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Top scorer is required')).not.toBeInTheDocument();
  });
}); 