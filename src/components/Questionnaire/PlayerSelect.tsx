"use client";

import React from "react";
import { Player } from "./types";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";

interface PlayerSelectProps {
  players: Player[];
  selectedPlayerId: string | null;
  onSelect: (playerId: string | null) => void;
  placeholder?: string;
  id?: string;
}

/**
 * A component for selecting players using a Combobox
 */
const PlayerSelect: React.FC<PlayerSelectProps> = (props) => {
  // Reverted: Map players to options directly
  const options: ComboboxOption[] = props.players.map(player => ({
    value: String(player.id), // Ensure value is a string
    label: player.name,
    disabled: false
  }));
  
  // Handle clear action
  const handleClear = () => {
    props.onSelect(null);
  };

  return (
    <Combobox
      options={options}
      selectedValue={props.selectedPlayerId}
      onChange={props.onSelect}
      onClear={handleClear}
      placeholder={props.placeholder || 'Select a player...'}
      id={props.id}
      ariaLabel={`Select a player for ${props.id || 'player selection'}`}
      showClearButton={true}
      emptyMessage="No players found"
      searchPlaceholder="Search players..."
      filterMode="fuzzy"
      maxHeight={250}
    />
  );
};

export default PlayerSelect; 