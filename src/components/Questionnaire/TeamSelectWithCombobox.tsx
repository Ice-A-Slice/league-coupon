"use client";

import React from "react";
import { Team } from "./types";
import { Combobox } from "@/components/ui/combobox";
import { teamSelectToComboboxProps } from "@/lib/combobox-adapters";

interface TeamSelectWithComboboxProps {
  teams: Team[];
  selectedTeamId: string | number | null;
  onSelect: (teamId: string | number | null) => void;
  placeholder?: string;
  id?: string;
}

/**
 * A drop-in replacement for TeamSelect that uses the new Combobox component
 * This maintains the same API as the original TeamSelect component but uses
 * the enhanced Combobox component internally.
 */
const TeamSelectWithCombobox: React.FC<TeamSelectWithComboboxProps> = (props) => {
  // Use our adapter to transform props to Combobox format
  const comboboxProps = teamSelectToComboboxProps(props);
  
  return (
    <Combobox
      options={comboboxProps.options}
      selectedValue={comboboxProps.selectedValue}
      onChange={comboboxProps.onChange}
      onClear={comboboxProps.onClear}
      placeholder={comboboxProps.placeholder}
      id={comboboxProps.id}
      ariaLabel={`Select a team for ${props.id || 'team selection'}`}
      showClearButton={true}
      emptyMessage="No teams found"
      searchPlaceholder="Search teams..."
      filterMode="contains"
      maxHeight={250}
    />
  );
};

export default TeamSelectWithCombobox; 