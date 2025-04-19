import { Match, Selections } from "@/components/BettingCoupon/types";
import { Prediction, Team, Player } from "@/components/Questionnaire/types";

// Updated with Serie A data
export const sampleMatches: Match[] = [
  { id: 'm1', homeTeam: "Inter", awayTeam: "Juventus" },
  { id: 'm2', homeTeam: "Milan", awayTeam: "Napoli" },
  { id: 'm3', homeTeam: "Roma", awayTeam: "Lazio" },
  { id: 'm4', homeTeam: "Fiorentina", awayTeam: "Atalanta" },
];

export const sampleTeams: Team[] = [
  { id: 't1', name: "Inter" },
  { id: 't2', name: "Juventus" },
  { id: 't3', name: "Milan" },
  { id: 't4', name: "Napoli" },
  { id: 't5', name: "Roma" },
  { id: 't6', name: "Lazio" },
  { id: 't7', name: "Fiorentina" },
  { id: 't8', name: "Atalanta" },
  // Add more if needed
];

export const samplePlayers: Player[] = [
  { id: 'p1', name: "Lautaro Martínez", teamId: 't1' }, // Inter
  { id: 'p2', name: "Dušan Vlahović", teamId: 't2' },   // Juventus
  { id: 'p3', name: "Rafael Leão", teamId: 't3' },      // Milan
  { id: 'p4', name: "Victor Osimhen", teamId: 't4' }, // Napoli
  { id: 'p5', name: "Paulo Dybala", teamId: 't5' },     // Roma
  { id: 'p6', name: "Ciro Immobile", teamId: 't6' },    // Lazio
  { id: 'p7', name: "Nicolás González", teamId: 't7'}, // Fiorentina
  { id: 'p8', name: "Teun Koopmeiners", teamId: 't8'}, // Atalanta
];

// Initial predictions remain empty
export const initialPredictions: Prediction = {
  leagueWinner: null,
  lastPlace: null,
  bestGoalDifference: null,
  topScorer: null
};

// Initial selections remain empty
export const initialSampleSelections: Selections = {}; 