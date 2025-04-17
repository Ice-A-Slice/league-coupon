"use client";

import React, { useState, useEffect, useRef } from "react";
import { Team } from "./types";
import { ChevronDownIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface TeamSelectProps {
  teams: Team[];
  selectedTeamId: string | number | null;
  onSelect: (teamId: string | number | null) => void;
  placeholder?: string;
  id?: string;
}

const TeamSelect = ({
  teams,
  selectedTeamId,
  onSelect,
  placeholder = "Select a team...",
  id = "team-select"
}: TeamSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the selected team
  const selectedTeam = selectedTeamId !== null
    ? teams.find(team => team.id === selectedTeamId)
    : null;

  // Filter teams based on search term
  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle clicking outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle selecting a team
  const handleTeamSelect = (team: Team) => {
    onSelect(team.id);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Handle clearing selection
  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearchTerm("");
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="relative flex items-center w-full px-2.5 sm:px-3 py-2 border rounded-md cursor-pointer bg-white border-gray-300 focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500"
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 0);
        }}
      >
        <div className="flex-1 min-w-0">
          {selectedTeam ? (
            <div className="flex items-center">
              <span className="text-sm font-medium truncate">{selectedTeam.name}</span>
              {selectedTeam && (
                <button
                  type="button"
                  className="ml-2 text-gray-400 hover:text-gray-500"
                  onClick={handleClearSelection}
                >
                  <XCircleIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <input
              type="text"
              ref={inputRef}
              className="w-full border-none p-0 focus:ring-0 text-sm placeholder-gray-400"
              placeholder={placeholder}
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={handleInputFocus}
              id={id}
            />
          )}
        </div>
        <ChevronDownIcon className="w-5 h-5 ml-1 sm:ml-2 text-gray-400 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 sm:max-h-60 overflow-auto">
          {searchTerm && !filteredTeams.length ? (
            <div className="px-3 sm:px-4 py-2 text-sm text-gray-500">No teams found</div>
          ) : (
            <>
              {selectedTeam && (
                <div className="sticky top-0 px-3 sm:px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Search for a different team
                </div>
              )}
              <ul className="py-1">
                {filteredTeams.map((team) => (
                  <li
                    key={team.id}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm cursor-pointer hover:bg-teal-50 ${
                      selectedTeamId === team.id ? "bg-teal-50 text-teal-600" : ""
                    }`}
                    onClick={() => handleTeamSelect(team)}
                  >
                    {team.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamSelect; 