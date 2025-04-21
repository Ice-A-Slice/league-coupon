// Import jest-dom's custom assertions
require('@testing-library/jest-dom');

// Mock environment variables required by Supabase client
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

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

// Mock for scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock Supabase client and auth methods
jest.mock('@/utils/supabase/client', () => {
  // Store the listener callback so tests can trigger it
  let authStateChangeListener = null;

  console.log('[MOCK_SETUP] Setting up Supabase client mock factory');
  
  return {
    createClient: jest.fn(() => {
      console.log('[MOCK_SETUP] Creating mocked Supabase client instance');
      return {
        auth: {
          // Mock getSession to be async and return a user
          getSession: jest.fn().mockImplementation(async () => {
            console.log('[MOCK_RUNTIME] getSession called');
            // Simulate minimal async delay
            await new Promise(resolve => setTimeout(resolve, 0)); 
            console.log('[MOCK_RUNTIME] getSession returning session');
            return {
              data: { session: { user: { id: 'test-user-id', email: 'test@example.com' } } },
              error: null
            };
          }),

          // Mock onAuthStateChange to store the callback
          onAuthStateChange: jest.fn().mockImplementation((callback) => {
            console.log('[MOCK_RUNTIME] onAuthStateChange listener registered');
            authStateChangeListener = callback;
            // Simulate initial check (often null before sign-in)
            // Or trigger immediately based on getSession mock? Let's start by NOT calling it here.
            // callback(null, null); // Or callback('INITIAL_SESSION', null)?
            
            return {
              data: {
                subscription: {
                  unsubscribe: jest.fn(() => {
                    console.log('[MOCK_RUNTIME] onAuthStateChange listener unsubscribed');
                    authStateChangeListener = null;
                  }),
                },
              },
              error: null
            };
          }),

          // Mock other methods if needed by tests, e.g.:
          signInWithOAuth: jest.fn().mockResolvedValue({ data: {}, error: null }),
          signOut: jest.fn().mockResolvedValue({ error: null }),

          // --- Helper for tests to trigger the listener --- 
          // Not part of real Supabase API, but useful for testing
          __triggerAuthStateChange: (event, session) => {
             console.log(`[MOCK_RUNTIME] Test trying to trigger auth change: ${event}`);
             if (authStateChangeListener) {
               console.log(`[MOCK_RUNTIME] Triggering listener with:`, event, session);
               authStateChangeListener(event, session);
             } else {
                console.log(`[MOCK_RUNTIME] No auth listener to trigger.`);
             }
          },
        },
        // Mock other Supabase methods if needed (e.g., from, rpc)
        from: jest.fn(() => { // Basic mock for .from()
           console.log('[MOCK_RUNTIME] supabase.from() called');
           return {
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn().mockResolvedValue({ data: [], error: null }),
            update: jest.fn().mockResolvedValue({ data: [], error: null }),
            delete: jest.fn().mockResolvedValue({ data: [], error: null }),
           };
        }),
      };
    })
  };
});

// Add any global setup needed for your tests here 