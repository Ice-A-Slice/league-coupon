// Use require for CommonJS modules
require('@testing-library/jest-dom');
require('whatwg-fetch'); // Use require for the polyfill

// Load test environment variables
require('dotenv').config({ path: '.env.test.local' });

// Polyfills for Next.js API routes in tests
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Ensure test environment variables are set
process.env.NODE_ENV = 'test';
process.env.EMAIL_TEST_MODE = 'true';

// Set default test environment variables if not already set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
}
if (!process.env.NEXT_PUBLIC_FOOTBALL_API_KEY) {
  process.env.NEXT_PUBLIC_FOOTBALL_API_KEY = 'test-api-key-for-testing';
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn() }),
  usePathname: () => '/',
}));

// Mock ResizeObserver which is not available in the jsdom environment
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observations = [];
  }
  observe(target) {
    this.observations.push(target);
  }
  unobserve(target) {
    this.observations = this.observations.filter(el => el !== target);
  }
  disconnect() {
    this.observations = [];
  }
};

// Mock for scrollIntoView (only if Element is available in this environment)
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
}

// Mock Supabase client and auth methods
jest.mock('@/utils/supabase/client', () => {
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id', email: 'test@example.com' }} }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    // Add mock for realtime channel
    channel: jest.fn(() => ({
      on: jest.fn(() => mockSupabaseClient.channel()), // Return channel for chaining .on().subscribe()
      subscribe: jest.fn((callback) => {
        // Optionally simulate successful subscription for logging/debugging
        if (callback) callback('SUBSCRIBED', null);
        // Return a mock subscription object
        return {
          unsubscribe: jest.fn(),
        };
      }),
    })),
    // Function to remove channels (needed for cleanup)
    removeChannel: jest.fn().mockResolvedValue('ok'), // Mock removeChannel
    // Add mock implementations for other Supabase methods if needed by tests
    from: jest.fn(() => mockSupabaseClient), // Return mock client for chaining
    select: jest.fn(() => mockSupabaseClient),
    insert: jest.fn(() => mockSupabaseClient),
    update: jest.fn(() => mockSupabaseClient),
    delete: jest.fn(() => mockSupabaseClient),
    eq: jest.fn(() => mockSupabaseClient),
    in: jest.fn(() => mockSupabaseClient),
    // Add more mocked methods as required by your tests
  };
  console.log('[MOCK_SETUP] Creating mocked Supabase client instance');
  return {
    createClient: jest.fn(() => {
      // Extend mock methods dynamically if needed per test suite
      // Mock getSession to return a session by default for authenticated tests
      mockSupabaseClient.auth.getSession = jest.fn().mockImplementation(() => {
          console.log('[MOCK_RUNTIME] getSession called');
          // Simulate returning a session by default
          // Tests needing unauthenticated state can override this mock
          console.log('[MOCK_RUNTIME] getSession returning session');
          return Promise.resolve({ data: { session: { user: { id: 'test-user-id', email: 'test@example.com' }} }, error: null });
        });
      mockSupabaseClient.auth.onAuthStateChange = jest.fn().mockImplementation(() => {
          console.log('[MOCK_RUNTIME] onAuthStateChange listener registered');
          // Return a mock subscription object
          return { data: { subscription: { unsubscribe: jest.fn(() => console.log('[MOCK_RUNTIME] onAuthStateChange listener unsubscribed')) } } };
        });

      return mockSupabaseClient;
    })
  };
});

// Global cleanup function
afterEach(() => {
  // Clean up mocks or other resources after each test if needed
  // For example, ensure listener mocks are cleared
  // if (window.scrollTo) {
  //   (window.scrollTo as jest.Mock).mockClear();
  // }
});

// Mock console methods globally if needed, or use jest.spyOn in specific tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Add any global setup needed for your tests here

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Set up localStorage mock (only if window is available in this environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });
}

// Clear localStorage before each test (only if window is available)
beforeEach(() => {
  if (typeof window !== 'undefined') {
    localStorageMock.clear.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    
    // Reset localStorage to empty state
    localStorageMock.getItem.mockReturnValue(null);
  }
});

// Database reset functionality for integration tests
let dbResetEnabled = false;

// Check if we should enable database reset (only for integration tests)
if (process.env.NODE_ENV === 'test' && process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1')) {
  dbResetEnabled = true;
  console.log('[JEST_SETUP] Database reset enabled for integration tests');
}

// Global setup for database tests
beforeEach(async () => {
  // Only reset database for integration tests, not unit tests
  if (dbResetEnabled && expect.getState().currentTestName?.includes('integration')) {
    try {
      const { resetDatabase } = require('./tests/utils/db');
      await resetDatabase(true);
      console.log('[JEST_SETUP] Database reset completed for test:', expect.getState().currentTestName);
    } catch (error) {
      console.warn('[JEST_SETUP] Database reset failed:', error.message);
      // Don't fail the test setup, just warn
    }
  }
});

// Global teardown
afterAll(async () => {
  if (dbResetEnabled) {
    try {
      const { disconnectDb } = require('./tests/utils/db');
      await disconnectDb();
      console.log('[JEST_SETUP] Database disconnected');
    } catch (error) {
      console.warn('[JEST_SETUP] Database disconnect failed:', error.message);
    }
  }
});