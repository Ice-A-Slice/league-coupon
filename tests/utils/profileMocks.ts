/**
 * Mock utilities for profile functionality to help tests work with auth-only approach
 */
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mock profile service that simulates profile queries using auth.users metadata
 */
export class MockProfileService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Mock profile query that returns data from auth.users.user_metadata
   */
  async getProfile(userId: string) {
    try {
      const { data: authUser, error } = await this.client.auth.admin.getUserById(userId);
      
      if (error || !authUser.user) {
        return { data: null, error: error || new Error('User not found') };
      }

      // Simulate profile structure using auth metadata
      const profileData = {
        id: authUser.user.id,
        full_name: authUser.user.user_metadata?.full_name || 
                   authUser.user.user_metadata?.name || 
                   authUser.user.user_metadata?.display_name ||
                   null,
        created_at: authUser.user.created_at,
        updated_at: authUser.user.updated_at
      };

      return { data: profileData, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Mock profile list query
   */
  async getProfiles(userIds: string[]) {
    const profiles = [];
    
    for (const userId of userIds) {
      const { data } = await this.getProfile(userId);
      if (data) {
        profiles.push(data);
      }
    }

    return { data: profiles, error: null };
  }
}

/**
 * Helper to get user display name from auth metadata
 */
export async function getUserDisplayName(client: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data: authUser } = await client.auth.admin.getUserById(userId);
    
    if (!authUser?.user) {
      return `User ${userId.slice(-8)}`;
    }

    const metadata = authUser.user.user_metadata || {};
    const displayName = metadata.full_name || metadata.name || metadata.display_name;
    
    if (displayName) {
      return displayName;
    }

    // Fallback to email prefix
    if (authUser.user.email) {
      const emailPrefix = authUser.user.email.split('@')[0];
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    }

    return `User ${userId.slice(-8)}`;
  } catch (error) {
    console.warn('Error getting user display name:', error);
    return `User ${userId.slice(-8)}`;
  }
}

/**
 * Helper to mock profile queries in Supabase client
 */
export function mockProfileQueries(client: any) {
  const originalFrom = client.from.bind(client);
  
  client.from = (table: string) => {
    if (table === 'profiles') {
      // Return mock query builder for profile queries
      return {
        select: (columns: string = '*') => ({
          eq: (column: string, value: any) => ({
            single: async () => {
              if (column === 'id') {
                const mockService = new MockProfileService(client);
                return await mockService.getProfile(value);
              }
              return { data: null, error: new Error('Not implemented') };
            }
          }),
          in: (column: string, values: any[]) => ({
            async: async () => {
              if (column === 'id') {
                const mockService = new MockProfileService(client);
                return await mockService.getProfiles(values);
              }
              return { data: [], error: null };
            }
          })
        }),
        insert: () => ({ data: null, error: null }),
        upsert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null })
      };
    }
    
    return originalFrom(table);
  };
  
  return client;
}