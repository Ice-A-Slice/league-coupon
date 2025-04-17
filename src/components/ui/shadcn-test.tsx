'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

export function ShadcnTest() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'contains' | 'startsWith' | 'fuzzy'>('contains');

  const teams = [
    { value: 'real-madrid', label: 'Real Madrid' },
    { value: 'arsenal', label: 'Arsenal' },
    { value: 'inter', label: 'Inter' },
    { value: 'bayern', label: 'Bayern München' },
    { value: 'newcastle', label: 'Newcastle' },
    { value: 'crystal-palace', label: 'Crystal Palace' },
    { value: 'manchester-united', label: 'Manchester United' },
    { value: 'tottenham', label: 'Tottenham' },
  ];

  const countries = [
    { value: 'es', label: 'Spain' },
    { value: 'en', label: 'England' },
    { value: 'it', label: 'Italy' },
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
    { value: 'pt', label: 'Portugal' },
    { value: 'nl', label: 'Netherlands' },
    { value: 'br', label: 'Brazil' },
  ];

  const players = [
    { value: 'mbappe', label: 'Kylian Mbappé' },
    { value: 'kane', label: 'Harry Kane' },
    { value: 'saka', label: 'Bukayo Saka' },
    { value: 'martinez', label: 'Lautaro Martínez', disabled: true },
    { value: 'isak', label: 'Alexander Isak' },
    { value: 'rashford', label: 'Marcus Rashford' },
    { value: 'son', label: 'Heung-min Son' },
    { value: 'lacazette', label: 'Alexandre Lacazette', disabled: true },
  ];

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">Shadcn/UI Test Component</h2>
      
      <div className="flex flex-wrap gap-2">
        <Button variant="default">Default Button</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon">🔍</Button>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-medium">Combobox Test with Different Filtering Modes</h3>
        
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Filter Mode:</label>
            <div className="flex gap-2">
              <Button 
                variant={filterMode === 'contains' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilterMode('contains')}
              >
                Contains
              </Button>
              <Button 
                variant={filterMode === 'startsWith' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilterMode('startsWith')}
              >
                Starts With
              </Button>
              <Button 
                variant={filterMode === 'fuzzy' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setFilterMode('fuzzy')}
              >
                Fuzzy
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label 
              id="team-label" 
              className="text-sm font-medium"
            >
              Team:
            </label>
            <Combobox 
              options={teams}
              selectedValue={selectedTeam}
              onChange={setSelectedTeam}
              placeholder="Select team"
              searchPlaceholder="Search teams..."
              emptyMessage="No team found"
              filterMode={filterMode}
              id="team-combobox"
              ariaLabelledby="team-label"
              onOpenChange={(open) => console.log(`Team dropdown ${open ? 'opened' : 'closed'}`)}
            />
            {selectedTeam && (
              <p className="text-sm">Selected: {teams.find(team => team.value === selectedTeam)?.label}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label 
              id="country-label" 
              className="text-sm font-medium"
            >
              Country:
            </label>
            <Combobox 
              options={countries}
              selectedValue={selectedCountry}
              onChange={setSelectedCountry}
              placeholder="Select country"
              searchPlaceholder="Search countries..."
              emptyMessage="No country found"
              filterMode={filterMode}
              id="country-combobox"
              ariaLabelledby="country-label"
            />
            {selectedCountry && (
              <p className="text-sm">Selected: {countries.find(country => country.value === selectedCountry)?.label}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label 
              id="player-label" 
              className="text-sm font-medium"
            >
              Player:
            </label>
            <p id="player-description" className="text-xs text-muted-foreground mb-2">
              Some players are disabled and cannot be selected.
            </p>
            <Combobox 
              options={players}
              selectedValue={selectedPlayer}
              onChange={setSelectedPlayer}
              placeholder="Select player"
              searchPlaceholder="Search players..."
              emptyMessage="No player found"
              filterMode={filterMode}
              id="player-combobox"
              ariaLabelledby="player-label"
              ariaDescribedby="player-description"
            />
            {selectedPlayer && (
              <p className="text-sm">Selected: {players.find(player => player.value === selectedPlayer)?.label}</p>
            )}
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          <div className="p-3 border rounded bg-muted/10">
            <h4 className="text-sm font-medium mb-2">Filtering Modes:</h4>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li><strong>Contains:</strong> Matches any part of the text (e.g., &apos;ma&apos; finds &apos;Madrid&apos;)</li>
              <li><strong>Starts With:</strong> Matches beginning of text (e.g., &apos;ma&apos; finds &apos;Manchester&apos; but not &apos;Real Madrid&apos;)</li>
              <li><strong>Fuzzy:</strong> Handles typos and partial matches (e.g., &apos;mcst&apos; finds &apos;Manchester&apos;)</li>
            </ul>
          </div>
          
          <div className="p-3 border rounded bg-muted/10">
            <h4 className="text-sm font-medium mb-2">Keyboard Navigation:</h4>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li><strong>↓ Down Arrow:</strong> Move to next option</li>
              <li><strong>↑ Up Arrow:</strong> Move to previous option</li>
              <li><strong>Home:</strong> Jump to first option</li>
              <li><strong>End:</strong> Jump to last option</li>
              <li><strong>Enter:</strong> Select highlighted option</li>
              <li><strong>Escape:</strong> Close dropdown</li>
              <li><strong>Tab:</strong> Move focus out of dropdown</li>
              <li><strong>Type letters:</strong> Jump to option starting with those letters</li>
            </ul>
          </div>
          
          <div className="p-3 border rounded bg-muted/10">
            <h4 className="text-sm font-medium mb-2">Accessibility Features:</h4>
            <ul className="text-sm space-y-1 list-disc pl-5">
              <li><strong>Screen Reader Support:</strong> Properly announces dropdown state, selections, and options</li>
              <li><strong>ARIA Attributes:</strong> Includes proper ARIA labelling and relationships</li>
              <li><strong>Keyboard Focus:</strong> Clearly visible focus indicators and proper focus management</li>
              <li><strong>Disabled Options:</strong> Players dropdown includes disabled options that are skipped during keyboard navigation</li>
              <li><strong>Live Region Updates:</strong> Announces changes to screen readers via aria-live regions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 