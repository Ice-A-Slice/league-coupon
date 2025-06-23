import { POST } from './route'; // Import the handler to test
// The following imports are no longer needed directly as they are fully mocked by Jest
// import { createServerClient } from '@supabase/ssr';
// import { cookies } from 'next/headers';
// import { NextResponse } from 'next/server';

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
const mockSupabaseUpsert = jest.fn();

const mockInRoundFixtures = jest.fn();
const mockSelectRoundFixtures = jest.fn(() => ({ in: mockInRoundFixtures }));

const mockSingleRound = jest.fn();
const mockEqRound = jest.fn(() => ({ single: mockSingleRound }));
const mockSelectRound = jest.fn(() => ({ eq: mockEqRound }));

const mockFrom = jest.fn();

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
      return { status: init?.status ?? 200, body }; 
    }),
  },
}));

// --- Test Suite ---
describe('POST /api/bets', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'betting_round_fixtures') {
        return { select: mockSelectRoundFixtures }; 
      } else if (tableName === 'betting_rounds') {
        return { select: mockSelectRound };
      } else if (tableName === 'user_bets') {
        return { upsert: mockSupabaseUpsert };
      }
      console.warn(`Unmocked table called in test: ${tableName}`);
      return { select: jest.fn(), upsert: jest.fn() };
    });
  });

  // Test case 1: Successful submission
  it('should return 200 OK on successful bet submission for an open round', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockBettingRoundId = 1;
    const mockFixtureId1 = 673;
    const mockFixtureId2 = 675;
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
    mockInRoundFixtures.mockResolvedValue({ 
        data: [ { betting_round_id: mockBettingRoundId }, { betting_round_id: mockBettingRoundId }], 
        error: null 
    });
    mockSingleRound.mockResolvedValue({ 
        data: { status: 'open', earliest_fixture_kickoff: futureKickoff.toISOString() }, 
        error: null 
    });
    mockSupabaseUpsert.mockResolvedValue({ error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('betting_round_fixtures');
    expect(mockInRoundFixtures).toHaveBeenCalledWith('fixture_id', submittedFixtureIds);
    expect(mockFrom).toHaveBeenCalledWith('betting_rounds');
    expect(mockEqRound).toHaveBeenCalledWith('id', mockBettingRoundId);
    expect(mockFrom).toHaveBeenCalledWith('user_bets');
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ message: 'Bets submitted successfully!' }, { status: 200 });
  });

  // Test case 2: Unauthorized access
  it('should return 401 Unauthorized if user is not authenticated', async () => {
    // Arrange
    const request = new Request('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify([{ fixture_id: 1, prediction: '1' }]),
      headers: { 'Content-Type': 'application/json' },
    });
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null }, error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
  });

  // Test case 3: Invalid request body
  it('should return 400 Bad Request if request body is not a valid array', async () => {
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
      await POST(request);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid request body. Expected a non-empty array of bets.' }, { status: 400 });
  });

  // Test case: Kickoff time is in the past
  it('should return 403 Forbidden if kickoff time is in the past', async () => {
    const mockUserId = 'test-user-123';
    const mockBettingRoundId = 3;
    const requestBody = [{ fixture_id: 710, prediction: 'X' }];
    const request = new Request('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });
    const pastKickoff = new Date();
    pastKickoff.setDate(pastKickoff.getDate() - 1);
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockInRoundFixtures.mockResolvedValue({ data: [{ betting_round_id: mockBettingRoundId }], error: null });
    mockSingleRound.mockResolvedValue({ data: { status: 'open', earliest_fixture_kickoff: pastKickoff.toISOString() }, error: null });

    await POST(request);

    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Cannot submit bets, the betting deadline has passed.' }, { status: 403 });
  });

  // Test case: Fixture not in a betting round
  it('should return 400 Bad Request if any submitted fixture is not in a betting round', async () => {
      const mockUserId = 'test-user-123';
      const invalidFixtureId = 9999;
      const requestBody = [{ fixture_id: invalidFixtureId, prediction: '1' }];
      const request = new Request('http://localhost/api/bets', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });
      mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
      mockInRoundFixtures.mockResolvedValue({ data: [], error: null }); 
      await POST(request);
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Invalid submission: Fixtures do not belong to a betting round.' }, { status: 400 });
  });
}); 