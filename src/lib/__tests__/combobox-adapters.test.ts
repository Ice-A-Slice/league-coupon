import {
  mapTeamsToComboboxOptions,
  mapPlayersToComboboxOptions,
  createComboboxChangeHandler,
  createComboboxClearHandler,
  mapSelectedValueToCombobox,
  findEntityById,
  teamSelectToComboboxProps,
  playerSelectToComboboxProps
} from '../combobox-adapters';
import { Team, Player } from '@/components/Questionnaire/types';

describe('Combobox Adapter Functions', () => {
  // Sample test data
  const teams: Team[] = [
    { id: 1, name: 'Arsenal' },
    { id: '2', name: 'Chelsea' },
    { id: 3, name: 'Liverpool' }
  ];
  
  const players: Player[] = [
    { id: 101, name: 'Kane', teamId: 1 },
    { id: '102', name: 'Salah', teamId: 3 },
    { id: 103, name: 'Mount', teamId: '2' }
  ];

  describe('mapTeamsToComboboxOptions', () => {
    it('should convert Team objects to ComboboxOption format', () => {
      const result = mapTeamsToComboboxOptions(teams);
      
      expect(result).toEqual([
        { value: '1', label: 'Arsenal', disabled: false },
        { value: '2', label: 'Chelsea', disabled: false },
        { value: '3', label: 'Liverpool', disabled: false }
      ]);
    });

    it('should handle empty array', () => {
      const result = mapTeamsToComboboxOptions([]);
      expect(result).toEqual([]);
    });
  });

  describe('mapPlayersToComboboxOptions', () => {
    it('should convert Player objects to ComboboxOption format', () => {
      const result = mapPlayersToComboboxOptions(players);
      
      expect(result).toEqual([
        { value: '101', label: 'Kane', disabled: false },
        { value: '102', label: 'Salah', disabled: false },
        { value: '103', label: 'Mount', disabled: false }
      ]);
    });

    it('should handle empty array', () => {
      const result = mapPlayersToComboboxOptions([]);
      expect(result).toEqual([]);
    });
  });

  describe('createComboboxChangeHandler', () => {
    it('should create a handler that converts string values to appropriate types', () => {
      const mockOnSelect = jest.fn();
      const handler = createComboboxChangeHandler(mockOnSelect);
      
      // Test with numeric string (should convert to number)
      handler('42');
      expect(mockOnSelect).toHaveBeenCalledWith(42);
      
      // Test with non-numeric string (should keep as string)
      handler('abc');
      expect(mockOnSelect).toHaveBeenCalledWith('abc');
    });
  });

  describe('createComboboxClearHandler', () => {
    it('should create a handler that calls onSelect with null', () => {
      const mockOnSelect = jest.fn();
      const handler = createComboboxClearHandler(mockOnSelect);
      
      handler();
      expect(mockOnSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('mapSelectedValueToCombobox', () => {
    it('should convert numeric ID to string', () => {
      const result = mapSelectedValueToCombobox(42);
      expect(result).toBe('42');
    });

    it('should keep string ID as string', () => {
      const result = mapSelectedValueToCombobox('abc');
      expect(result).toBe('abc');
    });

    it('should handle null value', () => {
      const result = mapSelectedValueToCombobox(null);
      expect(result).toBeNull();
    });
  });

  describe('findEntityById', () => {
    it('should find team by numeric ID', () => {
      const result = findEntityById(teams, 1);
      expect(result).toEqual({ id: 1, name: 'Arsenal' });
    });

    it('should find team by string ID', () => {
      const result = findEntityById(teams, '2');
      expect(result).toEqual({ id: '2', name: 'Chelsea' });
    });

    it('should return undefined for non-existent ID', () => {
      const result = findEntityById(teams, 99);
      expect(result).toBeUndefined();
    });

    it('should handle null ID', () => {
      const result = findEntityById(teams, null);
      expect(result).toBeUndefined();
    });
  });

  describe('teamSelectToComboboxProps', () => {
    it('should transform TeamSelect props to Combobox props', () => {
      const mockOnSelect = jest.fn();
      const teamSelectProps = {
        teams,
        selectedTeamId: 1,
        onSelect: mockOnSelect,
        placeholder: 'Select team...',
        id: 'team-select'
      };
      
      const result = teamSelectToComboboxProps(teamSelectProps);
      
      // Check transformed options
      expect(result.options).toEqual([
        { value: '1', label: 'Arsenal', disabled: false },
        { value: '2', label: 'Chelsea', disabled: false },
        { value: '3', label: 'Liverpool', disabled: false }
      ]);
      
      // Check selected value conversion
      expect(result.selectedValue).toBe('1');
      
      // Check placeholder and ID passthrough
      expect(result.placeholder).toBe('Select team...');
      expect(result.id).toBe('team-select');
      
      // Check handler transformation
      result.onChange('2');
      expect(mockOnSelect).toHaveBeenCalledWith(2); // Should convert back to number
      
      result.onClear();
      expect(mockOnSelect).toHaveBeenCalledWith(null);
    });

    it('should use default placeholder when not provided', () => {
      const mockOnSelect = jest.fn();
      const teamSelectProps = {
        teams,
        selectedTeamId: 1,
        onSelect: mockOnSelect
      };
      
      const result = teamSelectToComboboxProps(teamSelectProps);
      expect(result.placeholder).toBe('Select a team...');
    });
  });

  describe('playerSelectToComboboxProps', () => {
    it('should transform PlayerSelect props to Combobox props', () => {
      const mockOnSelect = jest.fn();
      const playerSelectProps = {
        players,
        selectedPlayerId: 101,
        onSelect: mockOnSelect,
        placeholder: 'Select player...',
        id: 'player-select'
      };
      
      const result = playerSelectToComboboxProps(playerSelectProps);
      
      // Check transformed options
      expect(result.options).toEqual([
        { value: '101', label: 'Kane', disabled: false },
        { value: '102', label: 'Salah', disabled: false },
        { value: '103', label: 'Mount', disabled: false }
      ]);
      
      // Check selected value conversion
      expect(result.selectedValue).toBe('101');
      
      // Check placeholder and ID passthrough
      expect(result.placeholder).toBe('Select player...');
      expect(result.id).toBe('player-select');
      
      // Check handler transformation
      result.onChange('102');
      expect(mockOnSelect).toHaveBeenCalledWith(102); // Should convert back to number
      
      result.onClear();
      expect(mockOnSelect).toHaveBeenCalledWith(null);
    });

    it('should use default placeholder when not provided', () => {
      const mockOnSelect = jest.fn();
      const playerSelectProps = {
        players,
        selectedPlayerId: 101,
        onSelect: mockOnSelect
      };
      
      const result = playerSelectToComboboxProps(playerSelectProps);
      expect(result.placeholder).toBe('Select a player...');
    });
  });
}); 