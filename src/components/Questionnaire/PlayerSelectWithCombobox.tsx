"use client";

import React from "react";
import { Player, Team } from "./types";
import { Combobox } from "@/components/ui/combobox";
import { playerSelectToComboboxProps } from "@/lib/combobox-adapters";

interface PlayerSelectWithComboboxProps {
  players: Player[];
  teams?: Team[]; // Kept for API compatibility
  selectedPlayerId: string | number | null;
  onSelect: (playerId: string | number | null) => void;
  placeholder?: string;
  id?: string;
}

/**
 * A drop-in replacement for PlayerSelect that uses the new Combobox component
 * This maintains the same API as the original PlayerSelect component but uses
 * the enhanced Combobox component internally.
 */
const PlayerSelectWithCombobox: React.FC<PlayerSelectWithComboboxProps> = (props) => {
  // Use our adapter to transform props to Combobox format
  const comboboxProps = playerSelectToComboboxProps(props);
  
  return (
    <Combobox
      options={comboboxProps.options}
      selectedValue={comboboxProps.selectedValue}
      onChange={comboboxProps.onChange}
      onClear={comboboxProps.onClear}
      placeholder={comboboxProps.placeholder}
      id={comboboxProps.id}
      ariaLabel={`Select a player for ${props.id || 'player selection'}`}
      showClearButton={true}
      emptyMessage="No players found"
      searchPlaceholder="Search players..."
      filterMode="fuzzy"
      maxHeight={250}
    />
  );
};

export default PlayerSelectWithCombobox; 