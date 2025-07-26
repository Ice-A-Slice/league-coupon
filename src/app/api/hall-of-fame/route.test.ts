/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { connectToTestDb, resetDatabase, disconnectDb, createTestProfiles, seedHallOfFameData, seedTestData } from '../../../../tests/utils/db';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

describe('/api/hall-of-fame - Main Hall of Fame API', () => {
  let client: SupabaseClient<Database>;
  let testProfiles: Array<{ id: string; full_name: string | null; }>;

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
    await seedHallOfFameData(client, testProfiles);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  const createMockRequest = (searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost/api/hall-of-fame');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return new NextRequest(url);
  };

  describe('Successful requests', () => {
    it('should return Hall of Fame data with default parameters', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.pagination).toEqual({
        total_items: 2,
        total_pages: 1,
        current_page: 1,
        page_size: 20,
        has_more: false,
      });
    });
  });
}); 