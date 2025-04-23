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

// Mock @supabase/ssr
const mockSupabaseGetUser = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseOrder = jest.fn();
const mockSupabaseLimit = jest.fn();
const mockSupabaseMaybeSingle = jest.fn();
const mockSupabaseSingle = jest.fn(); // Needed for fixture round_id lookup
const mockSupabaseUpsert = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSupabaseSelect,
  upsert: mockSupabaseUpsert,
}));
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
    mockSupabaseSelect.mockClear();
    mockSupabaseOrder.mockClear();
    mockSupabaseLimit.mockClear();
    mockSupabaseMaybeSingle.mockClear();
    mockSupabaseSingle.mockClear();
    mockSupabaseUpsert.mockClear();
    mockFrom.mockClear();
    mockNextResponseJson.mockClear();
    (cookies as jest.Mock).mockClear();
    (createServerClient as jest.Mock).mockClear();
    (NextResponse.json as jest.Mock).mockClear();
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
    const request = new Request('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock Supabase calls
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    // Mock fixture lookup for locking check (needs .single() for the first fixture)
    mockFrom.mockImplementation((tableName) => {
        if (tableName === 'fixtures') {
            // Need to chain mocks correctly
            const selectMock = jest.fn().mockReturnThis(); // Return `this` for chaining
            const eqMock = jest.fn().mockReturnThis();
            const orderMock = jest.fn().mockReturnThis();
            const limitMock = jest.fn().mockReturnThis();
            const singleMock = jest.fn();
            const maybeSingleMock = jest.fn();
            
            selectMock.mockImplementation((columns) => {
                 if (columns === 'round_id') {
                      eqMock.mockReturnValue({ single: singleMock });
                      singleMock.mockResolvedValue({ data: { round_id: mockRoundId }, error: null });
                 } else if (columns === 'kickoff') {
                     // Simulate round is open (kickoff in the future)
                     const futureKickoff = new Date();
                     futureKickoff.setDate(futureKickoff.getDate() + 1); 
                     eqMock.mockReturnValue({ 
                        order: orderMock.mockReturnValue({ 
                            limit: limitMock.mockReturnValue({ 
                                maybeSingle: maybeSingleMock.mockResolvedValue({ data: { kickoff: futureKickoff.toISOString() }, error: null }) 
                            })
                        })
                     });
                 }
                 return { eq: eqMock }; // Return the next chainable mock
            });

            return { select: selectMock }; // Initial return for .from('fixtures')
        } else if (tableName === 'user_bets') {
            mockSupabaseUpsert.mockResolvedValue({ error: null }); // Simulate successful upsert
            return { upsert: mockSupabaseUpsert };
        }
        return { select: jest.fn(), upsert: jest.fn() }; // Default fallback
    });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    // Check locking check calls (fixture lookup and kickoff check)
    expect(mockFrom).toHaveBeenCalledWith('fixtures');
    // Check TOTAL calls to mockFrom (fixtures + user_bets)
    expect(mockFrom).toHaveBeenCalledTimes(3); // Expect 3 calls: round_id, kickoff, upsert
    // Check upsert call
    expect(mockFrom).toHaveBeenCalledWith('user_bets');
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockSupabaseUpsert.mock.calls[0][0]; // Get the first argument of the first call
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
    expect(mockSupabaseUpsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id, fixture_id' }); // Check onConflict option

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
  it('should return 403 Forbidden if the round has already started', async () => {
      // Arrange
      const mockUserId = 'test-user-403';
      const mockRoundId = 70;
      const mockFixtureId = 700;
      const requestBody = [{ fixture_id: mockFixtureId, prediction: '2' }];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });
      
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock fixture lookup for locking check 
      mockFrom.mockImplementation((tableName) => {
          if (tableName === 'fixtures') {
              const selectMock = jest.fn();
              const eqMock = jest.fn();
              const orderMock = jest.fn();
              const limitMock = jest.fn();
              const singleMock = jest.fn();
              const maybeSingleMock = jest.fn();
              
              selectMock.mockImplementation((columns) => {
                   if (columns === 'round_id') {
                        eqMock.mockReturnValue({ single: singleMock });
                        // Return the round ID for the first fixture lookup
                        singleMock.mockResolvedValue({ data: { round_id: mockRoundId }, error: null });
                   } else if (columns === 'kickoff') {
                       // Simulate round is LOCKED (kickoff in the past)
                       const pastKickoff = new Date();
                       pastKickoff.setDate(pastKickoff.getDate() - 1); // Set kickoff to yesterday
                       eqMock.mockReturnValue({ 
                          order: orderMock.mockReturnValue({ 
                              limit: limitMock.mockReturnValue({ 
                                  // Return the past kickoff time
                                  maybeSingle: maybeSingleMock.mockResolvedValue({ data: { kickoff: pastKickoff.toISOString() }, error: null })
                              })
                          })
                       });
                   }
                   return { eq: eqMock };
              });
              return { select: selectMock };
          } 
          // We don't expect user_bets to be called in this case
          return { select: jest.fn(), upsert: jest.fn() }; 
      });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures'); // Locking check called
      expect(mockFrom).toHaveBeenCalledTimes(2); // Both round_id and kickoff lookup
      expect(mockSupabaseUpsert).not.toHaveBeenCalled(); // Should not attempt upsert
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Cannot submit bets, the round has already started.' }, { status: 403 });
  });

  // Test case 6: Fixture not found during locking check
  it('should return 404 Not Found if a fixture ID is invalid during locking check', async () => {
      // Arrange
      const mockUserId = 'test-user-404';
      const invalidFixtureId = 9999;
      const requestBody = [{ fixture_id: invalidFixtureId, prediction: '1' }];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock fixture lookup to return null data (not found)
      mockFrom.mockImplementation((tableName) => {
          if (tableName === 'fixtures') {
              const selectMock = jest.fn();
              const eqMock = jest.fn();
              const singleMock = jest.fn();
              
              selectMock.mockImplementation((columns) => {
                   if (columns === 'round_id') {
                        eqMock.mockReturnValue({ single: singleMock });
                        // Simulate fixture not found
                        singleMock.mockResolvedValue({ data: null, error: null }); 
                   } 
                   return { eq: eqMock };
              });
              return { select: selectMock };
          } 
          return { select: jest.fn(), upsert: jest.fn() }; 
      });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures');
      expect(mockFrom).toHaveBeenCalledTimes(1); // Only the round_id lookup should happen
      expect(mockSupabaseUpsert).not.toHaveBeenCalled(); 
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: `Fixture with ID ${invalidFixtureId} not found.` }, { status: 404 });
  });
  
  // Test case 7: Database error during upsert
  it('should return 500 Internal Server Error if database upsert fails', async () => {
      // Arrange - Similar setup to success case, but mock upsert failure
      const mockUserId = 'test-user-500-upsert';
      const mockRoundId = 71;
      const mockFixtureId = 710;
      const requestBody = [{ fixture_id: mockFixtureId, prediction: 'X' }];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock locking check to succeed (return future kickoff)
      mockFrom.mockImplementation((tableName) => {
          if (tableName === 'fixtures') {
              const selectMock = jest.fn();
              const eqMock = jest.fn();
              const orderMock = jest.fn();
              const limitMock = jest.fn();
              const singleMock = jest.fn();
              const maybeSingleMock = jest.fn();
              selectMock.mockImplementation((columns) => {
                   if (columns === 'round_id') {
                        eqMock.mockReturnValue({ single: singleMock });
                        singleMock.mockResolvedValue({ data: { round_id: mockRoundId }, error: null });
                   } else if (columns === 'kickoff') {
                       const futureKickoff = new Date();
                       futureKickoff.setDate(futureKickoff.getDate() + 1); 
                       eqMock.mockReturnValue({ 
                          order: orderMock.mockReturnValue({ limit: limitMock.mockReturnValue({ maybeSingle: maybeSingleMock.mockResolvedValue({ data: { kickoff: futureKickoff.toISOString() }, error: null }) }) })
                       });
                   }
                   return { eq: eqMock };
              });
              return { select: selectMock };
          } else if (tableName === 'user_bets') {
              // Simulate upsert failure
              mockSupabaseUpsert.mockResolvedValue({ error: new Error('Simulated DB error') }); 
              return { upsert: mockSupabaseUpsert };
          }
          return { select: jest.fn(), upsert: jest.fn() }; 
      });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures');
      expect(mockFrom).toHaveBeenCalledWith('user_bets');
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1); // Upsert was attempted
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Failed to save bets to database.' }, { status: 500 });
  });
  
  // Test case 8: Database error during locking check (kickoff fetch)
  it('should return 500 Internal Server Error if fetching kickoff time fails', async () => {
      // Arrange
      const mockUserId = 'test-user-500-kickoff';
      const mockRoundId = 72;
      const mockFixtureId = 720;
      const requestBody = [{ fixture_id: mockFixtureId, prediction: '1' }];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      // Mock locking check - round_id lookup succeeds, kickoff lookup fails
      mockFrom.mockImplementation((tableName) => {
          if (tableName === 'fixtures') {
              const selectMock = jest.fn();
              const eqMock = jest.fn();
              const orderMock = jest.fn();
              const limitMock = jest.fn();
              const singleMock = jest.fn();
              const maybeSingleMock = jest.fn();
              selectMock.mockImplementation((columns) => {
                   if (columns === 'round_id') {
                        eqMock.mockReturnValue({ single: singleMock });
                        singleMock.mockResolvedValue({ data: { round_id: mockRoundId }, error: null });
                   } else if (columns === 'kickoff') {
                       // Simulate kickoff fetch failure
                       eqMock.mockReturnValue({ 
                          order: orderMock.mockReturnValue({ limit: limitMock.mockReturnValue({ maybeSingle: maybeSingleMock.mockResolvedValue({ data: null, error: new Error('Kickoff DB error') }) }) })
                       });
                   }
                   return { eq: eqMock };
              });
              return { select: selectMock };
          }
          return { select: jest.fn(), upsert: jest.fn() }; 
      });

      // Act
      await POST(request);

      // Assert
      expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('fixtures');
      expect(mockFrom).toHaveBeenCalledTimes(2); // Attempted both lookups
      expect(mockSupabaseUpsert).not.toHaveBeenCalled(); // Should fail before upsert
      expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Internal server error: Could not verify round kickoff.' }, { status: 500 });
  });

}); 