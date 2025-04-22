import { GET } from './route'; // Import the handler
import { NextResponse } from 'next/server'; // Keep for type checking if needed
import { getTeamsForSeason } from '@/lib/supabase/queries'; // Import the function to mock
// We don't need to import supabaseServerClient here anymore as we mock it fully

// Define a simple type for the mock team data
type MockTeam = { id: number; name: string };

// --- Mocks ---

// Mock the database query function directly
jest.mock('@/lib/supabase/queries', () => ({
  getTeamsForSeason: jest.fn(),
}));

// Mock the server client, assigning jest.fn() directly
jest.mock('@/lib/supabase/server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

// Define an interface for our mocked NextResponse *before* mocking
interface MockedNextResponse {
  _jsonMock: jest.Mock;
  json: (body: unknown, init?: { status?: number }) => { status: number; body: unknown };
}

// Mock next/server, assigning jest.fn() directly
jest.mock('next/server', () => ({
  NextResponse: {
    // Store the mock function reference separately for tracking.
    _jsonMock: jest.fn(),
    json: function(body: unknown, init?: { status?: number }) { // Use unknown
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)._jsonMock(body, init); // Use type assertion here if needed, or define 'this' type
      return { status: init?.status ?? 200, body }; // Return plain object
    },
  },
}));

// --- Access Mocks ---
// Now require the mocked modules to get access to the mock functions
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getTeamsForSeason } = require('@/lib/supabase/queries') as { getTeamsForSeason: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { supabaseServerClient } = require('@/lib/supabase/server') as { supabaseServerClient: { from: jest.Mock; select: jest.Mock; eq: jest.Mock; single: jest.Mock; } };
// Need to access the internal _jsonMock we created
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NextResponse } = require('next/server') as { NextResponse: MockedNextResponse }; // Use the interface
const mockNextResponseJson = NextResponse._jsonMock; // Access directly now

// --- Mock Data ---
const mockTeamsData: MockTeam[] = [
  { id: 101, name: 'Team Alpha' },
  { id: 102, name: 'Team Bravo' },
];
const mockDbSeasonId = 999; // Mock database season ID found by findSeasonId

// --- Test Suite ---
describe('GET /api/teams', () => {
  beforeEach(() => {
    // Reset mocks directly using the refs obtained via require
    // jest.clearAllMocks() is generally sufficient, but explicit resets can be clearer
    getTeamsForSeason.mockClear();
    supabaseServerClient.from.mockClear().mockReturnThis();
    supabaseServerClient.select.mockClear().mockReturnThis();
    supabaseServerClient.eq.mockClear().mockReturnThis();
    supabaseServerClient.single.mockClear();
    mockNextResponseJson.mockClear();

    // Default mock for findSeasonId success using the accessed mock
    supabaseServerClient.single.mockResolvedValue({ data: { id: mockDbSeasonId }, error: null });

  });

  it('should return 200 OK with teams on valid request', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    getTeamsForSeason.mockResolvedValue(mockTeamsData);

    // Act
    await GET(request);

    // Assert
    // Use the accessed mock functions directly
    expect(supabaseServerClient.from).toHaveBeenCalledWith('seasons');
    expect(supabaseServerClient.select).toHaveBeenCalledWith('id, competition:competitions!inner(api_league_id)');
    expect(supabaseServerClient.eq).toHaveBeenCalledWith('api_season_year', parseInt(seasonYear));
    expect(supabaseServerClient.eq).toHaveBeenCalledWith('competition.api_league_id', parseInt(leagueId));
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).toHaveBeenCalledWith(mockDbSeasonId);
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(mockTeamsData, undefined);
  });

  it('should return 400 Bad Request if league parameter is missing', async () => {
    // Arrange
    const seasonYear = '2024';
    const url = `http://localhost/api/teams?season=${seasonYear}`;
    const request = new Request(url);

    // Act
    await GET(request);

    // Assert
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getTeamsForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing league or season query parameter' }, { status: 400 });
  });

  it('should return 400 Bad Request if season parameter is missing', async () => {
    // Arrange
    const leagueId = '39';
    const url = `http://localhost/api/teams?league=${leagueId}`;
    const request = new Request(url);
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getTeamsForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing league or season query parameter' }, { status: 400 });
  });

  it('should return 400 Bad Request if league parameter is not a number', async () => {
    // Arrange
    const leagueId = 'abc';
    const seasonYear = '2024';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getTeamsForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid league or season parameter' }, { status: 400 });
  });

  it('should return 400 Bad Request if season parameter is not a number', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = 'abc';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getTeamsForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid league or season parameter' }, { status: 400 });
  });

  it('should return 404 Not Found if season is not found in DB', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '1999';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    supabaseServerClient.single.mockResolvedValue({ data: null, error: null }); // Use accessed mock
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: `Season not found in database for league ${leagueId}, year ${seasonYear}` }, { status: 404 });
  });

  it('should return 500 Internal Server Error if findSeasonId query fails', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    supabaseServerClient.single.mockResolvedValue({ data: null, error: new Error('DB connection failed') }); // Use accessed mock
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: `Season not found in database for league ${leagueId}, year ${seasonYear}` }, { status: 404 });
  });

  it('should return 500 Internal Server Error if getTeamsForSeason query fails', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    // findSeasonId succeeds via beforeEach mock
    getTeamsForSeason.mockResolvedValue(null);
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).toHaveBeenCalledWith(mockDbSeasonId);
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Failed to fetch teams from database' }, { status: 500 });
  });

  it('should return 200 OK with an empty array if no teams are found', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2025';
    const url = `http://localhost/api/teams?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    // findSeasonId succeeds via beforeEach mock
    getTeamsForSeason.mockResolvedValue([]);
    // Act
    await GET(request);
    // Assert
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).toHaveBeenCalledTimes(1);
    expect(getTeamsForSeason).toHaveBeenCalledWith(mockDbSeasonId);
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith([], undefined);
  });
}); 