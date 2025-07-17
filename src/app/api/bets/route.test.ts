/**
 * @jest-environment node
 */
import { POST } from './route';
import {
  connectToTestDb,
  resetDatabase,
  disconnectDb,
  createTestProfiles,
  seedTestData,
} from '../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type MockSupabaseClient = ReturnType<typeof createServerClient>;

// Mock the createServerClient function to control authentication
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>;

describe('POST /api/bets', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null; }>;

  // Helper function to create authenticated mock
  function createAuthenticatedMock(userId: string) {
    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: userId, email: 'test@example.com' } },
          error: null,
        }),
      },
      from: jest.fn((tableName) => {
        return client.from(tableName);
      }),
    };
  }

  // Helper function to create unauthenticated mock
  function createUnauthenticatedMock() {
    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
  }

  beforeAll(async () => {
    client = await connectToTestDb();
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedTestData();
    testProfiles = [
      { id: 'user-1', full_name: 'John Doe' },
      { id: 'user-2', full_name: 'Jane Smith' },
    ];
    await createTestProfiles(testProfiles);
    
    // Reset mock before each test
    mockCreateServerClient.mockReset();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('should return 200 OK on successful bet submission for an open round', async () => {
    const userId = testProfiles[0].id;
    const requestBody = [
      { fixture_id: 1, prediction: '1' },
      { fixture_id: 2, prediction: 'X' },
    ];

    const mockSupabaseClient = createAuthenticatedMock(userId);
    mockCreateServerClient.mockReturnValue(mockSupabaseClient as MockSupabaseClient);

    const request = new NextRequest('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Bets submitted successfully!');

    // Verify the bets were saved to the database
    const { data: userBets, error } = await client
      .from('user_bets')
      .select('*')
      .eq('user_id', userId);

    expect(error).toBeNull();
    expect(userBets).toHaveLength(2);
  });
  
  it('should return 401 Unauthorized if user is not authenticated', async () => {
    const mockSupabaseClient = createUnauthenticatedMock();
    mockCreateServerClient.mockReturnValue(mockSupabaseClient as MockSupabaseClient);

    const request = new NextRequest('http://localhost/api/bets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 400 Bad Request if request body is not a valid array', async () => {
    const userId = testProfiles[0].id;

    const mockSupabaseClient = createAuthenticatedMock(userId);
    mockCreateServerClient.mockReturnValue(mockSupabaseClient as MockSupabaseClient);

    const request = new NextRequest('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify({ "not": "an-array" }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body. Expected a non-empty array of bets.');
  });
  
  it('should return 403 Forbidden if kickoff time is in the past', async () => {
    const userId = testProfiles[0].id;
    const fixtureIdInPast = 1;

    // Manually set a fixture's kickoff to the past and update the betting round
    const pastKickoff = new Date();
    pastKickoff.setDate(pastKickoff.getDate() - 1);
    await client
      .from('fixtures')
      .update({ kickoff_time: pastKickoff.toISOString() })
      .eq('id', fixtureIdInPast);

    // Also update the betting round's earliest_fixture_kickoff to be in the past
    await client
      .from('betting_rounds')
      .update({ earliest_fixture_kickoff: pastKickoff.toISOString() })
      .eq('id', 1);

    const requestBody = [{ fixture_id: fixtureIdInPast, prediction: '1' }];

    const mockSupabaseClient = createAuthenticatedMock(userId);
    mockCreateServerClient.mockReturnValue(mockSupabaseClient as MockSupabaseClient);

    const request = new NextRequest('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Cannot submit bets, the betting deadline has passed.');
  });

  it('should return 400 Bad Request if any submitted fixture is not in a betting round', async () => {
    const userId = testProfiles[0].id;
    const invalidFixtureId = 9999; // An ID that doesn't exist in our seeded data
    const requestBody = [{ fixture_id: invalidFixtureId, prediction: '1' }];

    const mockSupabaseClient = createAuthenticatedMock(userId);
    mockCreateServerClient.mockReturnValue(mockSupabaseClient as MockSupabaseClient);

    const request = new NextRequest('http://localhost/api/bets', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid submission: Fixtures do not belong to a betting round.');
  });
}); 