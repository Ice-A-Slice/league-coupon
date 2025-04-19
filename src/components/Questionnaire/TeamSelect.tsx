"use client";

import React from "react";
import { Team } from "./types";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";

interface TeamSelectProps {
  teams: Team[];
  selectedTeamId: string | null;
  onSelect: (teamId: string | null) => void;
  placeholder?: string;
  id?: string;
}

/**
 * A component for selecting teams using a Combobox
 */
const TeamSelect: React.FC<TeamSelectProps> = (props) => {
  // Reverted: Map teams to options directly
  const options: ComboboxOption[] = props.teams.map(team => ({
    value: String(team.id), // Ensure value is a string
    label: team.name,
    disabled: false
  }));

  // Handle clear action
  const handleClear = () => {
    props.onSelect(null);
  };
  
  return (
    <Combobox
      options={options}
      selectedValue={props.selectedTeamId}
      onChange={props.onSelect}
      onClear={handleClear}
      placeholder={props.placeholder || 'Select a team...'}
      id={props.id}
      ariaLabel={`Select a team for ${props.id || 'team selection'}`}
      showClearButton={true}
      emptyMessage="No teams found"
      searchPlaceholder="Search teams..."
      filterMode="fuzzy"
      maxHeight={250}
    />
  );
};

export default TeamSelect; 