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

// Mock Supabase Select method
const mockSupabaseSelect = jest.fn();

// Mock Supabase query methods for chaining
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();

// Mock Supabase Upsert method - this needs to return an object with select method for chaining
const mockSupabaseUpsert = jest.fn(() => ({
  select: mockSupabaseSelect
}));

// Enhanced Mock Supabase from method to handle different table queries
const mockFrom = jest.fn((tableName: string) => {
  // Return different behavior based on table name
  if (tableName === 'seasons') {
    // For seasons table - support .select().eq().single() chain
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: mockSupabaseSingle
        }))
      }))
    };
  } else if (tableName === 'user_season_answers') {
    // For user_season_answers table - support existing upsert behavior
    return {
      upsert: mockSupabaseUpsert,
    };
  }
  // Default fallback
  return {
    upsert: mockSupabaseUpsert,
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: mockSupabaseSingle
      }))
    }))
  };
});

// Mock Supabase auth
const mockSupabaseGetUser = jest.fn();
const mockAuth = {
  getUser: mockSupabaseGetUser,
};

// Mock Supabase client
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
describe('POST /api/season-answers', () => {
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockCookieStore.get.mockClear();
    mockCookieStore.set.mockClear();
    mockCookieStore.delete.mockClear();
    mockSupabaseGetUser.mockClear();
    mockSupabaseSelect.mockClear();
    mockSupabaseUpsert.mockClear();
    mockSupabaseEq.mockClear();
    mockSupabaseSingle.mockClear();
    mockFrom.mockClear();
    mockNextResponseJson.mockClear();
    (cookies as jest.Mock).mockClear();
    (createServerClient as jest.Mock).mockClear();
    (NextResponse.json as jest.Mock).mockClear();
  });

  // Test case 1: Successful submission
  it('should return 200 OK on successful submission of season answers', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockSeasonId = 7; // Current season ID
    const requestBody = [
      { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null },
      { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 },
    ];
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock Supabase calls
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    // Mock the current season query
    mockSupabaseSingle.mockResolvedValue({ data: { id: mockSeasonId }, error: null });
    mockSupabaseSelect.mockResolvedValue({ data: requestBody, error: null }); // Return data from select, not upsert

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('seasons'); // Should query seasons table first
    expect(mockFrom).toHaveBeenCalledWith('user_season_answers'); // Then user_season_answers table
    expect(mockSupabaseSingle).toHaveBeenCalledTimes(1); // For seasons query
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockSupabaseSelect).toHaveBeenCalledTimes(1);
    
    // Check that upsert was called with the correct arguments (using dynamic season ID)
    const upsertArg = mockSupabaseUpsert.mock.calls[0][0]; // Get the first argument of the first call
    expect(upsertArg).toHaveLength(requestBody.length);
    expect(upsertArg[0]).toMatchObject({
        user_id: mockUserId,
        season_id: mockSeasonId, // Should use the dynamically fetched season ID
        question_type: 'league_winner',
        answered_team_id: 1,
        answered_player_id: null,
    });
    expect(upsertArg[1]).toMatchObject({
        user_id: mockUserId,
        season_id: mockSeasonId, // Should use the dynamically fetched season ID
        question_type: 'top_scorer',
        answered_team_id: null,
        answered_player_id: 101,
    });
    expect(mockSupabaseUpsert.mock.calls[0][1]).toEqual({ 
        onConflict: 'user_id, season_id, question_type' 
    }); // Check onConflict option

    // Check final response
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { message: 'Answers saved successfully', data: requestBody }, 
      { status: 200 }
    );
  });

  // Test case 2: Unauthorized access
  it('should return 401 Unauthorized if user is not authenticated', async () => {
    // Arrange
    const requestBody = [
      { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null }
    ];
    const request = new Request('http://localhost/api/season-answers', {
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
    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
  });

  // Test case 3: Authentication error
  it('should return 401 Unauthorized if there is an authentication error', async () => {
    // Arrange
    const requestBody = [
      { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null }
    ];
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock getUser to return an auth error
    mockSupabaseGetUser.mockResolvedValue({ 
      data: { user: null }, 
      error: { message: 'Auth error' } 
    });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
  });

  // Test case 4: Invalid request body (not an array)
  it('should return 400 Bad Request if request body is not a valid array', async () => {
    // Arrange
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify({ question_type: 'league_winner', answered_team_id: 1 }), // Object instead of array
      headers: { 'Content-Type': 'application/json' },
    });
    
    // Mock getUser to return a valid user
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'Invalid request body', details: expect.any(String) }, 
      { status: 400 }
    );
  });

  // Test case 5: Invalid request body (empty array)
  it('should return 400 Bad Request if request body is an empty array', async () => {
    // Arrange
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify([]), // Empty array
      headers: { 'Content-Type': 'application/json' },
    });
    
    // Mock getUser to return a valid user
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
    // Mock the current season query (needed even for empty array to reach the validation)
    mockSupabaseSingle.mockResolvedValue({ data: { id: 7 }, error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('seasons'); // Should query seasons table
    expect(mockSupabaseSingle).toHaveBeenCalledTimes(1); // For seasons query
    expect(mockSupabaseUpsert).not.toHaveBeenCalled(); // Should not reach upsert
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'No answers provided' }, 
      { status: 400 }
    );
  });

  // Test case 6: Missing required fields
  it('should return 400 Bad Request if any required fields are missing', async () => {
    // Arrange
    const requestBody = [
      { answered_team_id: 1 } // Missing question_type
    ];
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });
    
    // Mock getUser to return a valid user
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'Invalid request body', details: expect.any(String) }, 
      { status: 400 }
    );
  });

  // Test case 7: Database error during upsert
  it('should return 500 Internal Server Error if there is a database error during upsert', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockSeasonId = 7;
    const requestBody = [
      { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null }
    ];
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock Supabase calls
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    // Mock the current season query
    mockSupabaseSingle.mockResolvedValue({ data: { id: mockSeasonId }, error: null });
    // Error should come from select, since that's what the API checks
    mockSupabaseSelect.mockResolvedValue({ 
      data: null, 
      error: { message: 'Database error' } 
    }); // Simulate DB error

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('seasons'); // Should query seasons table first
    expect(mockFrom).toHaveBeenCalledWith('user_season_answers'); // Then user_season_answers table
    expect(mockSupabaseSingle).toHaveBeenCalledTimes(1); // For seasons query
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockSupabaseSelect).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'Database error saving answers', details: 'Database error' }, 
      { status: 500 }
    );
  });

  // Test case 8: Unexpected error
  it('should return 500 Internal Server Error if an unexpected error occurs', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockSeasonId = 7;
    const requestBody = [
      { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null }
    ];
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock Supabase calls
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    // Mock the current season query
    mockSupabaseSingle.mockResolvedValue({ data: { id: mockSeasonId }, error: null });
    
    // Instead of throwing from upsert, throw from select
    mockSupabaseSelect.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('seasons'); // Should query seasons table first
    expect(mockFrom).toHaveBeenCalledWith('user_season_answers'); // Then user_season_answers table
    expect(mockSupabaseSingle).toHaveBeenCalledTimes(1); // For seasons query
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockSupabaseSelect).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'An unexpected error occurred' }, 
      { status: 500 }
    );
  });

  // Test case 9: Valid data with different question types
  it('should handle different question types correctly', async () => {
    // Arrange
    const mockUserId = 'test-user-123';
    const mockSeasonId = 7;
    const requestBody = [
      { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null },
      { question_type: 'last_place', answered_team_id: 2, answered_player_id: null },
      { question_type: 'best_goal_difference', answered_team_id: 3, answered_player_id: null },
      { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 101 }
    ];
    const request = new Request('http://localhost/api/season-answers', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
    });

    // Mock Supabase calls
    mockSupabaseGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    // Mock the current season query
    mockSupabaseSingle.mockResolvedValue({ data: { id: mockSeasonId }, error: null });
    mockSupabaseSelect.mockResolvedValue({ data: requestBody, error: null });

    // Act
    await POST(request);

    // Assert
    expect(mockSupabaseGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('seasons'); // Should query seasons table first
    expect(mockFrom).toHaveBeenCalledWith('user_season_answers'); // Then user_season_answers table
    expect(mockSupabaseSingle).toHaveBeenCalledTimes(1); // For seasons query
    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockSupabaseSelect).toHaveBeenCalledTimes(1);
    
    // Check that all question types were processed correctly (using dynamic season ID)
    const upsertArg = mockSupabaseUpsert.mock.calls[0][0];
    expect(upsertArg).toHaveLength(requestBody.length);
    expect(upsertArg.map(item => item.question_type)).toEqual([
      'league_winner', 'last_place', 'best_goal_difference', 'top_scorer'
    ]);
    // Check that all use the dynamic season ID
    expect(upsertArg.every(item => item.season_id === mockSeasonId)).toBe(true);
    
    expect(mockNextResponseJson).toHaveBeenCalledTimes(1);
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { message: 'Answers saved successfully', data: requestBody }, 
      { status: 200 }
    );
  });
}); 