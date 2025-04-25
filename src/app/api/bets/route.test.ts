import { POST } from './route'; // Import the handler to test
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// --- Mocks ---

// Mock next/headers
const mockCookieStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => mockCookieStore), // Return our mock store
}));

// Mock @supabase/ssr - REFINE MOCKS for clarity
const mockSupabaseGetUser = jest.fn();
const mockSupabaseUpsert = jest.fn();

// Consolidate chaining mocks for fixture lookups
const mockMaybeSingle = jest.fn(); 
const mockLimit = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = jest.fn(() => ({ limit: mockLimit }));
const mockIn = jest.fn(() => ({ order: mockOrder })); 
const mockSelect = jest.fn(() => ({ in: mockIn }));

const mockFrom = jest.fn(); // Keep the main mockFrom

const mockAuth = {
  getUser: mockSupabaseGetUser,
};
const mockSupabaseClient = {
  auth: mockAuth,
  from: mockFrom,
};
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

// Mock next/server
const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => {
      mockNextResponseJson(body, init); // Track calls
      // Return a simple object simulating the response structure for inspection
      return { status: init?.status ?? 200, body }; 
    }),
  },
}));

// --- Test Suite ---
describe('POST /api/bets', () => {
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockCookieStore.get.mockClear();
    mockCookieStore.set.mockClear();
    mockCookieStore.delete.mockClear();
    mockSupabaseGetUser.mockClear();
    mockSupabaseUpsert.mockClear();
    // Reset refined chaining mocks
    mockSelect.mockClear();
    mockIn.mockClear();
    mockOrder.mockClear();
    mockLimit.mockClear();
    mockMaybeSingle.mockClear();
    mockFrom.mockClear();
    mockNextResponseJson.mockClear();
    (cookies as jest.Mock).mockClear();
    (createServerClient as jest.Mock).mockClear();
    (NextResponse.json as jest.Mock).mockClear();

    // Default mock implementation for .from()
    mockFrom.mockImplementation((tableName) => {
      if (tableName === 'fixtures') {
        // Return the start of the refined chain for fixtures
        return { select: mockSelect }; 
      } else if (tableName === 'user_bets') {
        return { upsert: mockSupabaseUpsert };
      }
      // Default fallback if needed
      return { select: jest.fn(() => ({ in: jest.fn(() => ({ order: jest.fn(() => ({ limit: jest.fn(() => ({ maybeSingle: jest.fn() })) })) })) })), upsert: jest.fn() };
    });
  });

  // Test case 1: Successful submission
  it('should return 200 OK on successful bet submission for an open round', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockRoundId = 69;
    const mockFixtureId1 = 680;
    const mockFixtureId2 = 682;
    const requestBody = [
      { fixture_id: mockFixtureId1, prediction: '1' },
      { fixture_id: mockFixtureId2, prediction: 'X' },
    ];
    const submittedFixtureIds = [mockFixtureId1, mockFixtureId2];
    const request = new Request('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const futureKickoff = new Date();
    futureKickoff.setDate(futureKickoff.getDate() + 1); 

    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    // Mock the single fixture lookup for locking check (now checks submitted IDs)
    mockMaybeSingle.mockResolvedValue({ data: { kickoff: futureKickoff.toISOString(), round_id: mockRoundId }, error: null });
    // Mock successful upsert
    mockSupabaseUpsert.mockResolvedValue({ error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    // Check locking check call
    expect(mockFrom).toHaveBeenCalledWith('fixtures');
    expect(mockSelect).toHaveBeenCalledWith('kickoff, round_id');
    expect(mockIn).toHaveBeenCalledWith('id', submittedFixtureIds);
    expect(mockOrder).toHaveBeenCalledWith('kickoff', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    // Check TOTAL calls to mockFrom (fixtures + user_bets)
    expect(mockFrom).toHaveBeenCalledTimes(2); // Updated: 1 for fixtures, 1 for user_bets
    // Check upsert call
    expect(mockFrom).toHaveBeenCalledWith('user_bets');
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockSupabaseUpsert.mock.calls[0][0];
    expect(upsertArg).toHaveLength(requestBody.length);
    expect(upsertArg[0]).toMatchObject({
        user_id: mockUserId,
        fixture_id: mockFixtureId1,
        prediction: '1',
        round_id: mockRoundId,
    });
     expect(upsertArg[1]).toMatchObject({
        user_id: mockUserId,
        fixture_id: mockFixtureId2,
        prediction: 'X',
        round_id: mockRoundId,
    });
    expect(mockSupabaseUpsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id, fixture_id' });
    // Check final response
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ message: 'Bets submitted successfully!' }, { status: 200 });
  });

  // Test case 2: Unauthorized access
  it('should return 401 Unauthorized if user is not authenticated', async () => {
    // Arrange
    const requestBody = [{ fixture_id: 1, prediction: '1' }]; // Example body
    const request = new Request('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock getUser to return no user
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null }, error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled(); // Should not attempt DB operations
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
  });

  // Test case 3: Invalid request body (not array)
  it('should return 400 Bad Request if request body is not a valid array', async () => {
      // Arrange
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify({ fixture_id: 1, prediction: '1' }), // Send an object, not an array
        headers: { 'Content-Type': 'application/json' },
      });
      // Mock getUser to return a valid user (needed to get past auth check)
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).not.toHaveBeenCalled(); // Should fail before DB interaction
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid request body. Expected a non-empty array of bets.' }, { status: 400 });
  });
  
  // Test case 4: Invalid request body (empty array)
  it('should return 400 Bad Request if request body is an empty array', async () => {
       // Arrange
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify([]), // Send an empty array
        headers: { 'Content-Type': 'application/json' },
      });
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).not.toHaveBeenCalled(); 
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid request body. Expected a non-empty array of bets.' }, { status: 400 });
  });

  // Test case 5: Round has already started (locked)
  it('should return 403 Forbidden if the betting deadline has passed', async () => {
      // Arrange
      const mockUserId = 'test-user-403';
      const mockRoundId = 70; // Still useful to have in mock data
      const mockFixtureId = 700;
      const requestBody = [{ fixture_id: mockFixtureId, prediction: '2' }];
      const submittedFixtureIds = [mockFixtureId];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });
      const pastKickoff = new Date();
      pastKickoff.setDate(pastKickoff.getDate() - 1); // Kickoff was yesterday
      
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock fixture lookup to return a past kickoff time
      mockMaybeSingle.mockResolvedValue({ data: { kickoff: pastKickoff.toISOString(), round_id: mockRoundId }, error: null });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures'); 
      expect(mockSelect).toHaveBeenCalledWith('kickoff, round_id');
      expect(mockIn).toHaveBeenCalledWith('id', submittedFixtureIds);
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1); 
      expect(mockFrom).toHaveBeenCalledTimes(1); // Updated: Only called for fixtures check
      expect(mockSupabaseUpsert).not.toHaveBeenCalled(); // Should not attempt upsert
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      // Updated error message based on new logic
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Cannot submit bets, the betting deadline has passed.' }, { status: 403 });
  });

  // Test case 6: Invalid fixture ID during locking check
  it('should return 500 Internal Server Error if kickoff cannot be determined for submitted fixtures', async () => {
      // Arrange
      const mockUserId = 'test-user-404';
      const invalidFixtureId = 9999;
      const requestBody = [{ fixture_id: invalidFixtureId, prediction: '1' }];
      const submittedFixtureIds = [invalidFixtureId];
       const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock fixture lookup to return no data (simulating invalid ID)
      mockMaybeSingle.mockResolvedValue({ data: null, error: null }); 

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures');
      expect(mockSelect).toHaveBeenCalledWith('kickoff, round_id');
      expect(mockIn).toHaveBeenCalledWith('id', submittedFixtureIds);
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
      expect(mockSupabaseUpsert).not.toHaveBeenCalled(); 
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      // Updated: The code now throws 500 if kickoff can't be determined
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Internal server error: Inconsistent fixture data.' }, { status: 500 });
  });
  
  // Test case 7: Database error during upsert
  it('should return 500 Internal Server Error if database upsert fails', async () => {
      // Arrange
      const mockUserId = 'test-user-500-upsert';
      const mockRoundId = 71;
      const mockFixtureId = 710;
      const requestBody = [{ fixture_id: mockFixtureId, prediction: 'X' }];
      const submittedFixtureIds = [mockFixtureId];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });
      const futureKickoff = new Date();
      futureKickoff.setDate(futureKickoff.getDate() + 1); 
      
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock fixture check to succeed
      mockMaybeSingle.mockResolvedValue({ data: { kickoff: futureKickoff.toISOString(), round_id: mockRoundId }, error: null });
      // Mock upsert to fail
      const upsertDbError = { message: 'Database unavailable', code: '50000' };
      mockSupabaseUpsert.mockResolvedValue({ error: upsertDbError });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      // Check locking check calls were made
      expect(mockFrom).toHaveBeenCalledWith('fixtures');
      expect(mockSelect).toHaveBeenCalledWith('kickoff, round_id');
      expect(mockIn).toHaveBeenCalledWith('id', submittedFixtureIds);
      // Check upsert call was made
      expect(mockFrom).toHaveBeenCalledWith('user_bets');
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1); // Upsert was attempted
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Failed to save bets to database.' }, { status: 500 });
  });

  // Test case 8: Database error during locking check (kickoff fetch)
  it('should return 500 Internal Server Error if fetching kickoff time fails', async () => {
      // Arrange
       const mockUserId = 'test-user-500-kickoff';
      const mockFixtureId = 720;
      const requestBody = [{ fixture_id: mockFixtureId, prediction: '1' }];
      const submittedFixtureIds = [mockFixtureId];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });
      const kickoffDbError = { message: 'Connection error', code: '50001' };

      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock fixture kickoff lookup to throw an error
      mockMaybeSingle.mockResolvedValue({ data: null, error: kickoffDbError });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures');
      expect(mockSelect).toHaveBeenCalledWith('kickoff, round_id');
      expect(mockIn).toHaveBeenCalledWith('id', submittedFixtureIds);
      expect(mockMaybeSingle).toHaveBeenCalledTimes(1); // Updated: Only one kickoff check now
      expect(mockSupabaseUpsert).not.toHaveBeenCalled(); // Should fail before upsert
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      // Updated expected error message
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Internal server error: Could not verify betting deadline.' }, { status: 500 });
  });

}); 