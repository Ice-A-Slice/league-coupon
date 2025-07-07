// Use require for CommonJS modules
require('@testing-library/jest-dom');
require('whatwg-fetch'); // Use require for the polyfill

// Mock environment variables required by Supabase client
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock environment variables required by email service
process.env.EMAIL_TEST_MODE = 'true';

// Mock environment variable required by football API
process.env.NEXT_PUBLIC_FOOTBALL_API_KEY = 'test-api-key-for-testing';

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