/**
 * Mock profile creation for tests that bypasses auth.users requirements
 * This is a temporary solution to unblock tests while we migrate away from profiles table
 */

import { v4 as uuidv4 } from 'uuid';

export interface MockProfile {
  id: string;
  full_name: string | null;
  email?: string;
}

/**
 * Creates mock profiles for testing without requiring auth.users records
 * This should only be used in test environments where FK constraints are relaxed
 * or where we're testing components that don't directly interact with the database
 */
export function createMockProfiles(count: number = 1): MockProfile[] {
  const profiles: MockProfile[] = [];
  
  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    profiles.push({
      id,
      full_name: `Test User ${i + 1}`,
      email: `test-user-${i + 1}@example.com`
    });
  }
  
  return profiles;
}

/**
 * Creates a mock profile with specific attributes
 */
export function createMockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: overrides.id || uuidv4(),
    full_name: overrides.full_name !== undefined ? overrides.full_name : 'Test User',
    email: overrides.email || `test-${Date.now()}@example.com`
  };
}

/**
 * Mock auth user for testing authentication flows
 */
export interface MockAuthUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    name?: string;
    display_name?: string;
  };
}

/**
 * Creates a mock auth user that matches Supabase auth user structure
 */
export function createMockAuthUser(profile: MockProfile): MockAuthUser {
  return {
    id: profile.id,
    email: profile.email || `user-${profile.id}@example.com`,
    user_metadata: {
      full_name: profile.full_name || undefined,
      name: profile.full_name || undefined,
      display_name: profile.full_name || undefined
    }
  };
}

/**
 * Helper to generate consistent test UUIDs
 */
export function generateTestUUID(prefix: string = 'test'): string {
  // Generate a UUID that's valid but recognizable as test data
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `00000000-${prefix.substring(0, 4)}-4000-8000-${timestamp}${random}`.substring(0, 36);
}