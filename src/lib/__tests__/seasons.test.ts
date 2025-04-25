// src/lib/__tests__/seasons.test.ts

import { createClient } from '@/utils/supabase/client';
import { getCurrentSeasonId } from '../seasons'; // Adjust path relative to __tests__

// Mock the Supabase client module
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}));

// Define a type for our mock client based on methods used in tests
type MockSupabaseClient = {
  from: jest.Mock<MockSupabaseClient, unknown[]>;
  select: jest.Mock<MockSupabaseClient, unknown[]>;
  eq: jest.Mock<MockSupabaseClient, unknown[]>;
  limit: jest.Mock<MockSupabaseClient, unknown[]>;
  single: jest.Mock<Promise<{ data: unknown; error: unknown }>, unknown[]>; // Use unknown[] for args
};

describe('getCurrentSeasonId', () => {
  let mockSupabaseClient: MockSupabaseClient;

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();

    // Mock the chainable query builder methods
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    } as MockSupabaseClient; // Cast might be needed depending on TS strictness

    // Configure the mocked createClient to return our mock instance
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  test('should return the season ID when one season is current', async () => {
    const expectedSeasonId = 123;
    mockSupabaseClient.single.mockResolvedValue({
      data: { id: expectedSeasonId },
      error: null,
    });

    await expect(getCurrentSeasonId()).resolves.toBe(expectedSeasonId);

    // Verify the mock calls
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('seasons');
    expect(mockSupabaseClient.select).toHaveBeenCalledWith('id');
    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('is_current', true);
    expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
    expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
  });

  test('should return null when no season is current', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      // Simulate PostgREST error for "No rows found" when using .single()
      error: { code: 'PGRST116', message: 'No rows found', details: '', hint: '' },
    });

    // Spy on console.warn to check the log message
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await expect(getCurrentSeasonId()).resolves.toBeNull();

    expect(consoleWarnSpy).toHaveBeenCalledWith('No season currently marked as active.');
    expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore(); // Clean up spy
  });

   test('should return null when no data is returned without error', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: null, // Simulate scenario where query returns null data unexpectedly
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    await expect(getCurrentSeasonId()).resolves.toBeNull();

    expect(consoleWarnSpy).toHaveBeenCalledWith('No data returned for current season query, even without error.');
    expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });

  test('should return null on a database query error', async () => {
    const dbError = new Error('Database connection failed');
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: dbError,
    });

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(getCurrentSeasonId()).resolves.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching current season ID:', dbError);
    expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  test('should return null on an unexpected error during execution', async () => {
     const unexpectedError = new Error('Something unexpected happened');
    // Make one of the chained methods throw to simulate unexpected error
    mockSupabaseClient.eq.mockImplementation(() => {
      throw unexpectedError;
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(getCurrentSeasonId()).resolves.toBeNull();

    // Check if the catch block logged the error
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected error in getCurrentSeasonId:', unexpectedError);

    consoleErrorSpy.mockRestore();
  });

});