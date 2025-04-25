import { createClient } from '@/utils/supabase/client';
import { getCurrentSeasonId } from '../seasons'; // Function under test depends on this
import { getCurrentBettingRoundId } from '../rounds'; // Function under test

// Mock the Supabase client module
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

// Mock the seasons module
jest.mock('../seasons', () => ({
  getCurrentSeasonId: jest.fn(),
}));

// Define a type for our mock client based on methods used in tests
type MockSupabaseClient = {
  from: jest.Mock<MockSupabaseClient, unknown[]>;
  select: jest.Mock<MockSupabaseClient, unknown[]>;
  eq: jest.Mock<MockSupabaseClient, unknown[]>;
  order: jest.Mock<MockSupabaseClient, unknown[]>;
  limit: jest.Mock<MockSupabaseClient, unknown[]>;
  maybeSingle: jest.Mock<Promise<{ data: unknown; error: unknown }>, unknown[]>; // Use unknown[] for args
};

describe('getCurrentBettingRoundId', () => {
  let mockSupabaseClient: MockSupabaseClient;
  // Cast the mocked function to allow Jest mock function calls
  const mockGetCurrentSeasonId = getCurrentSeasonId as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the chainable query builder methods for the fixtures query
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(), // Use maybeSingle based on implementation
    } as MockSupabaseClient;

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  test('should return round_id when active season and NS fixture exist', async () => {
    const activeSeasonId = 123;
    const expectedRoundId = 5;
    mockGetCurrentSeasonId.mockResolvedValue(activeSeasonId);
    mockSupabaseClient.maybeSingle.mockResolvedValue({
      data: { round_id: expectedRoundId }, // Mock the earliest NS fixture result
      error: null,
    });

    await expect(getCurrentBettingRoundId()).resolves.toBe(expectedRoundId);

    // Verify mocks
    expect(mockGetCurrentSeasonId).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('fixtures');
    // Check filters (can be more specific if needed)
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('status_short', 'NS');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('rounds.season_id', activeSeasonId);
    expect(mockSupabaseClient.order).toHaveBeenCalledWith('kickoff', { ascending: true });
    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
    expect(mockSupabaseClient.maybeSingle).toHaveBeenCalledTimes(1);
  });

  test('should return null when active season exists but no NS fixtures found', async () => {
    const activeSeasonId = 123;
    mockGetCurrentSeasonId.mockResolvedValue(activeSeasonId);
    mockSupabaseClient.maybeSingle.mockResolvedValue({
      data: null, // Simulate no fixture found
      error: null,
    });

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(); // Spy on console.log

    await expect(getCurrentBettingRoundId()).resolves.toBeNull();

    expect(mockGetCurrentSeasonId).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.maybeSingle).toHaveBeenCalledTimes(1);
    // Check if the specific log message was called
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`No 'Not Started' fixtures found for season ${activeSeasonId}`));

    consoleLogSpy.mockRestore(); // Clean up spy
  });

  test('should return null when no active season is found', async () => {
    mockGetCurrentSeasonId.mockResolvedValue(null); // Simulate no active season

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await expect(getCurrentBettingRoundId()).resolves.toBeNull();

    // Verify getCurrentSeasonId was called but the fixture query was not
    expect(mockGetCurrentSeasonId).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('Cannot fetch betting round ID because no active season was found.');

    consoleWarnSpy.mockRestore();
  });

  test('should return null when active season exists but fixture query fails', async () => {
    const activeSeasonId = 123;
    const dbError = new Error('Fixture query failed');
    mockGetCurrentSeasonId.mockResolvedValue(activeSeasonId);
    mockSupabaseClient.maybeSingle.mockResolvedValue({
      data: null,
      error: dbError,
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(getCurrentBettingRoundId()).resolves.toBeNull();

    expect(mockGetCurrentSeasonId).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.maybeSingle).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching earliest NS fixture:', dbError);

    consoleErrorSpy.mockRestore();
  });

   test('should return null on an unexpected error during execution', async () => {
    const unexpectedError = new Error('Something unexpected happened');
    mockGetCurrentSeasonId.mockResolvedValue(123); // Assume season fetch works
    // Make the fixture query throw an error
     mockSupabaseClient.select.mockImplementation(() => {
       throw unexpectedError;
     });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(getCurrentBettingRoundId()).resolves.toBeNull();

    // Check if the catch block logged the error
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in getCurrentBettingRoundId:', unexpectedError);

    consoleErrorSpy.mockRestore();
  });

}); 