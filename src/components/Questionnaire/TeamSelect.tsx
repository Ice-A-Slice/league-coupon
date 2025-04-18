"use client";

import React from "react";
import { Team } from "./types";
import { Combobox } from "@/components/ui/combobox";
import { teamSelectToComboboxProps } from "@/lib/combobox-adapters";

interface TeamSelectProps {
  teams: Team[];
  selectedTeamId: string | number | null;
  onSelect: (teamId: string | number | null) => void;
  placeholder?: string;
  id?: string;
}

/**
 * A component for selecting teams using a Combobox
 */
const TeamSelect: React.FC<TeamSelectProps> = (props) => {
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
      filterMode="fuzzy"
      maxHeight={250}
    />
  );
};

export default TeamSelect; 