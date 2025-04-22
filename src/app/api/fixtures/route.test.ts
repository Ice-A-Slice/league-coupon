import { GET } from './route'; // Import the handler
// Keep NextResponse import for type checking if needed, but we mock its functionality
import { NextResponse } from 'next/server'; 
import { getFixturesForRound } from '@/lib/supabase/queries'; // Import the function to mock
import type { Match } from '@/components/BettingCoupon/types';

// --- Mocks ---

// Mock the database query function
jest.mock('@/lib/supabase/queries', () => ({
  getFixturesForRound: jest.fn(),
}));

// Mock the entire next/server module
const mockNextResponseJson = jest.fn(); // Simple tracker
jest.mock('next/server', () => ({
  NextResponse: {
    // Make sure the mock returns something simple, not undefined
    json: (body: any, init?: { status?: number }) => {
       mockNextResponseJson(body, init); // Track the call
       return { status: init?.status ?? 200, body }; // Return a plain object
    },
  },
}));

// --- Mock Data ---
const mockMatches: Match[] = [
  { id: 1, homeTeam: 'Mock Team A', awayTeam: 'Mock Team B' },
  { id: 2, homeTeam: 'Mock Team C', awayTeam: 'Mock Team D' },
];

// --- Test Suite ---
describe('GET /api/fixtures', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockNextResponseJson.mockClear(); // Clear the specific mock function
  });

  it('should return 200 OK with fixtures on valid request', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const roundName = 'Test Round 1';
    const url = `http://localhost/api/fixtures?league=${leagueId}&season=${seasonYear}&round=${encodeURIComponent(roundName)}`;
    const request = new Request(url);

    // Mock getFixturesForRound to return success data
    (getFixturesForRound as jest.Mock).mockResolvedValue(mockMatches);

    // Act
    await GET(request);

    // Assert
    expect(getFixturesForRound).toHaveBeenCalledTimes(1);
    expect(getFixturesForRound).toHaveBeenCalledWith(roundName, parseInt(seasonYear), parseInt(leagueId));
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    // Assert arguments passed to our tracker mock
    expect(mockNextResponseJson).toHaveBeenCalledWith(mockMatches, undefined);
  });

  it('should return 400 Bad Request if league parameter is missing', async () => {
    // Arrange
    const seasonYear = '2024';
    const roundName = 'Test Round 1';
    const url = `http://localhost/api/fixtures?season=${seasonYear}&round=${encodeURIComponent(roundName)}`;
    const request = new Request(url);

    // Act
    await GET(request);

    // Assert
    expect(getFixturesForRound).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing required query parameters: league, season, round' }, { status: 400 });
  });

  it('should return 400 Bad Request if season parameter is missing', async () => {
     // Arrange
    const leagueId = '39';
    const roundName = 'Test Round 1';
    const url = `http://localhost/api/fixtures?league=${leagueId}&round=${encodeURIComponent(roundName)}`;
    const request = new Request(url);

    // Act
    await GET(request);

    // Assert
    expect(getFixturesForRound).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing required query parameters: league, season, round' }, { status: 400 });
  });

   it('should return 400 Bad Request if round parameter is missing', async () => {
     // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/fixtures?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);

    // Act
    await GET(request);

    // Assert
    expect(getFixturesForRound).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing required query parameters: league, season, round' }, { status: 400 });
  });

  it('should return 500 Internal Server Error if database query fails', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const roundName = 'Test Round 1';
    const url = `http://localhost/api/fixtures?league=${leagueId}&season=${seasonYear}&round=${encodeURIComponent(roundName)}`;
    const request = new Request(url);

    // Mock getFixturesForRound to return null (simulating error)
    (getFixturesForRound as jest.Mock).mockResolvedValue(null);

    // Act
    await GET(request);

    // Assert
    expect(getFixturesForRound).toHaveBeenCalledTimes(1);
    expect(getFixturesForRound).toHaveBeenCalledWith(roundName, parseInt(seasonYear), parseInt(leagueId));
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    // Assert arguments passed to our tracker mock
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Failed to fetch fixtures from database' }, { status: 500 });
  });

  // Optional: Test case for when getFixturesForRound returns an empty array (still a success)
  it('should return 200 OK with an empty array if no fixtures are found', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const roundName = 'Non Existent Round';
    const url = `http://localhost/api/fixtures?league=${leagueId}&season=${seasonYear}&round=${encodeURIComponent(roundName)}`;
    const request = new Request(url);

    // Mock getFixturesForRound to return empty array
    (getFixturesForRound as jest.Mock).mockResolvedValue([]);

    // Act
    await GET(request);

    // Assert
    expect(getFixturesForRound).toHaveBeenCalledTimes(1);
    expect(getFixturesForRound).toHaveBeenCalledWith(roundName, parseInt(seasonYear), parseInt(leagueId));
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    // Assert arguments passed to our tracker mock
    expect(mockNextResponseJson).toHaveBeenCalledWith([], undefined);
  });

}); 