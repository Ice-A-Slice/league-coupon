/**
 * Combobox Adapter Functions
 * 
 * This module provides utility functions to transform data between the existing
 * dropdown components and the new Combobox component.
 */

import { ComboboxOption } from "@/components/ui/combobox";
import { Team, Player } from "@/components/Questionnaire/types";

/**
 * Converts an array of Team objects to the format expected by the Combobox component
 * 
 * @param teams Array of Team objects from the existing dropdown components
 * @returns Array of ComboboxOption objects compatible with the Combobox component
 */
export function mapTeamsToComboboxOptions(teams: Team[]): ComboboxOption[] {
  return teams.map(team => ({
    value: String(team.id), // Convert id to string since Combobox expects string values
    label: team.name,
    disabled: false
  }));
}

/**
 * Converts an array of Player objects to the format expected by the Combobox component
 * 
 * @param players Array of Player objects from the existing dropdown components
 * @returns Array of ComboboxOption objects compatible with the Combobox component
 */
export function mapPlayersToComboboxOptions(players: Player[]): ComboboxOption[] {
  return players.map(player => ({
    value: String(player.id), // Convert id to string since Combobox expects string values
    label: player.name,
    disabled: false
  }));
}

/**
 * Creates an onChange handler that works with the new Combobox and maintains compatibility
 * with the existing application state
 * 
 * @param onSelect Existing selection handler from TeamSelect or PlayerSelect
 * @returns A function compatible with Combobox's onChange API
 */
export function createComboboxChangeHandler(
  onSelect: (id: string | number | null) => void
): (value: string) => void {
  return (value: string) => {
    // If the original handler expects numeric IDs and this is a numeric string,
    // convert it back to a number to maintain compatibility
    const parsedValue = /^\d+$/.test(value) ? parseInt(value, 10) : value;
    onSelect(parsedValue);
  };
}

/**
 * Creates an onClear handler for the Combobox that maintains compatibility
 * with the existing application state
 * 
 * @param onSelect Existing selection handler from TeamSelect or PlayerSelect
 * @returns A function compatible with Combobox's onClear API
 */
export function createComboboxClearHandler(
  onSelect: (id: string | number | null) => void
): () => void {
  return () => {
    onSelect(null);
  };
}

/**
 * Converts the selected ID value from the existing format to the format expected by Combobox
 * 
 * @param selectedId The currently selected ID in string | number | null format
 * @returns A string value compatible with Combobox's selectedValue prop
 */
export function mapSelectedValueToCombobox(
  selectedId: string | number | null
): string | null {
  if (selectedId === null) {
    return null;
  }
  
  return String(selectedId);
}

/**
 * Find a Team or Player by ID in an array of entities
 * 
 * @param entities Array of Team or Player objects
 * @param id ID to find
 * @returns The found entity or undefined
 */
export function findEntityById<T extends Team | Player>(
  entities: T[],
  id: string | number | null
): T | undefined {
  if (id === null) return undefined;
  return entities.find(entity => entity.id === id);
}

/**
 * Combines all adapters into a single helper for TeamSelect to Combobox conversion
 * 
 * @param props Props for the TeamSelect component
 * @returns Props compatible with the Combobox component
 */
export function teamSelectToComboboxProps(
  props: {
    teams: Team[];
    selectedTeamId: string | number | null;
    onSelect: (teamId: string | number | null) => void;
    placeholder?: string;
    id?: string;
  }
): {
  options: ComboboxOption[];
  selectedValue: string | null;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  id?: string;
} {
  return {
    options: mapTeamsToComboboxOptions(props.teams),
    selectedValue: mapSelectedValueToCombobox(props.selectedTeamId),
    onChange: createComboboxChangeHandler(props.onSelect),
    onClear: createComboboxClearHandler(props.onSelect),
    placeholder: props.placeholder || 'Select a team...',
    id: props.id
  };
}

/**
 * Combines all adapters into a single helper for PlayerSelect to Combobox conversion
 * 
 * @param props Props for the PlayerSelect component
 * @returns Props compatible with the Combobox component
 */
export function playerSelectToComboboxProps(
  props: {
    players: Player[];
    selectedPlayerId: string | number | null;
    onSelect: (playerId: string | number | null) => void;
    placeholder?: string;
    id?: string;
  }
): {
  options: ComboboxOption[];
  selectedValue: string | null;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  id?: string;
} {
  return {
    options: mapPlayersToComboboxOptions(props.players),
    selectedValue: mapSelectedValueToCombobox(props.selectedPlayerId),
    onChange: createComboboxChangeHandler(props.onSelect),
    onClear: createComboboxClearHandler(props.onSelect),
    placeholder: props.placeholder || 'Select a player...',
    id: props.id
  };
} 