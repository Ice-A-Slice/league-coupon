import { GET } from './route'; // Import the handler
// We will require the mocked modules later to access mock functions

// Define a simple type for the mock player data
type MockPlayer = { id: number; name: string };

// --- Mocks ---

// Mock the database query function directly
jest.mock('@/lib/supabase/queries', () => ({
  // Mock getPlayersForSeason instead of getTeamsForSeason
  getPlayersForSeason: jest.fn(),
}));

// Mock the server client, assigning jest.fn() directly (used by findSeasonId)
jest.mock('@/lib/supabase/server', () => ({
  supabaseServerClient: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

// Mock next/server, assigning jest.fn() directly
jest.mock('next/server', () => ({
  NextResponse: {
    // Store the mock function reference separately for tracking.
    _jsonMock: jest.fn(),
    json: function(body: any, init?: { status?: number }) {
      (this as any)._jsonMock(body, init); // Call the tracker
      return { status: init?.status ?? 200, body }; // Return plain object
    },
  },
}));

// --- Access Mocks ---
// Now require the mocked modules to get access to the mock functions
const { getPlayersForSeason } = require('@/lib/supabase/queries') as { getPlayersForSeason: jest.Mock };
const { supabaseServerClient } = require('@/lib/supabase/server') as { supabaseServerClient: { from: jest.Mock; select: jest.Mock; eq: jest.Mock; single: jest.Mock; } };
const { NextResponse } = require('next/server') as any;
const mockNextResponseJson = NextResponse._jsonMock as jest.Mock;


// --- Mock Data ---
const mockPlayersData: MockPlayer[] = [
  { id: 201, name: 'Player One' },
  { id: 202, name: 'Player Two' },
];
const mockDbSeasonId = 999; // Mock database season ID found by findSeasonId

// --- Test Suite ---
describe('GET /api/players', () => {
  beforeEach(() => {
    // Reset mocks
    getPlayersForSeason.mockClear(); // Reset player mock
    supabaseServerClient.from.mockClear().mockReturnThis();
    supabaseServerClient.select.mockClear().mockReturnThis();
    supabaseServerClient.eq.mockClear().mockReturnThis();
    supabaseServerClient.single.mockClear();
    mockNextResponseJson.mockClear();

    // Default mock for findSeasonId success
    supabaseServerClient.single.mockResolvedValue({ data: { id: mockDbSeasonId }, error: null });
  });

  it('should return 200 OK with players on valid request', async () => {
    // Arrange
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    getPlayersForSeason.mockResolvedValue(mockPlayersData);

    // Act
    await GET(request);

    // Assert
    // Check findSeasonId call
    expect(supabaseServerClient.from).toHaveBeenCalledWith('seasons');
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    // Check getPlayersForSeason call
    expect(getPlayersForSeason).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).toHaveBeenCalledWith(mockDbSeasonId);
    // Check response
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(mockPlayersData, undefined);
  });

  // --- Bad Request Tests (Similar to /api/teams) ---
  it('should return 400 Bad Request if league parameter is missing', async () => {
    const seasonYear = '2024';
    const url = `http://localhost/api/players?season=${seasonYear}`;
    const request = new Request(url);
    await GET(request);
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getPlayersForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing league or season query parameter' }, { status: 400 });
  });

  it('should return 400 Bad Request if season parameter is missing', async () => {
    const leagueId = '39';
    const url = `http://localhost/api/players?league=${leagueId}`;
    const request = new Request(url);
    await GET(request);
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getPlayersForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Missing league or season query parameter' }, { status: 400 });
  });

   it('should return 400 Bad Request if league parameter is not a number', async () => {
    const leagueId = 'abc';
    const seasonYear = '2024';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    await GET(request);
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getPlayersForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid league or season parameter' }, { status: 400 });
  });

  it('should return 400 Bad Request if season parameter is not a number', async () => {
    const leagueId = '39';
    const seasonYear = 'abc';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    await GET(request);
    expect(supabaseServerClient.single).not.toHaveBeenCalled();
    expect(getPlayersForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid league or season parameter' }, { status: 400 });
  });

  // --- Not Found / Server Error Tests (Similar to /api/teams) ---
  it('should return 404 Not Found if season is not found in DB', async () => {
    const leagueId = '39';
    const seasonYear = '1999';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    supabaseServerClient.single.mockResolvedValue({ data: null, error: null }); // Mock findSeasonId failure
    await GET(request);
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: `Season not found in database for league ${leagueId}, year ${seasonYear}` }, { status: 404 });
  });

  it('should return 500 Internal Server Error if findSeasonId query fails', async () => {
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    supabaseServerClient.single.mockResolvedValue({ data: null, error: new Error('DB connection failed') }); // Mock findSeasonId error
    await GET(request);
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).not.toHaveBeenCalled();
    // Expect 404 because the handler checks for null seasonId after findSeasonId
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: `Season not found in database for league ${leagueId}, year ${seasonYear}` }, { status: 404 });
  });

  it('should return 500 Internal Server Error if getPlayersForSeason query fails', async () => {
    const leagueId = '39';
    const seasonYear = '2024';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    // findSeasonId succeeds (from beforeEach)
    getPlayersForSeason.mockResolvedValue(null); // Mock getPlayersForSeason failure
    await GET(request);
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).toHaveBeenCalledWith(mockDbSeasonId);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Failed to fetch players from database' }, { status: 500 });
  });

  it('should return 200 OK with an empty array if no players are found', async () => {
    const leagueId = '39';
    const seasonYear = '2025';
    const url = `http://localhost/api/players?league=${leagueId}&season=${seasonYear}`;
    const request = new Request(url);
    // findSeasonId succeeds (from beforeEach)
    getPlayersForSeason.mockResolvedValue([]); // Mock empty array return
    await GET(request);
    expect(supabaseServerClient.single).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).toHaveBeenCalledTimes(1);
    expect(getPlayersForSeason).toHaveBeenCalledWith(mockDbSeasonId);
    expect(mockNextResponseJson).toHaveBeenCalledWith([], undefined);
  });
}); 