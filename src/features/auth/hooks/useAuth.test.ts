import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import { createClient } from '@/utils/supabase/client';
import type { User, Subscription } from '@supabase/supabase-js';

// Mock the Supabase client module
// We need to mock the functions used within the hook: getUser and onAuthStateChange
jest.mock('@/utils/supabase/client', () => {
  const mockUnsubscribe = jest.fn();
  const mockOnAuthStateChange = jest.fn().mockImplementation((callback) => {
    // Store the callback to simulate events later
    (mockOnAuthStateChange as any).callback = callback;
    return {
      data: {
        subscription: {
          id: 'mock-subscription-id',
          callback: jest.fn(),
          unsubscribe: mockUnsubscribe,
        } as Subscription,
      },
    };
  });

  const mockGetUser = jest.fn();

  return {
    createClient: jest.fn(() => ({
      auth: {
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
      },
    })),
    // Expose mocks for manipulation in tests
    __mocks: {
      mockGetUser,
      mockOnAuthStateChange,
      mockUnsubscribe,
    },
  };
});

// Helper function to get the mock implementations
const getMocks = () => {
  const clientModule = require('@/utils/supabase/client');
  return clientModule.__mocks;
};

describe('useAuth Hook', () => {
  let mockGetUser: jest.Mock;
  let mockOnAuthStateChange: jest.Mock & { callback?: Function };
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    const mocks = getMocks();
    mockGetUser = mocks.mockGetUser;
    mockOnAuthStateChange = mocks.mockOnAuthStateChange;
    mockUnsubscribe = mocks.mockUnsubscribe;

    // Clear any previously stored callback
    delete (mockOnAuthStateChange as any).callback;
    // Reset call counts etc.
    mockGetUser.mockClear();
    mockOnAuthStateChange.mockClear();
    mockUnsubscribe.mockClear();
  });

  test('should return initial loading state', () => {
    // Mock getUser promise to be pending indefinitely for this test
    mockGetUser.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  test('should set user and stop loading on successful initial fetch', async () => {
    const mockUser = { id: '123', email: 'test@example.com' } as User;
    // Mock getUser to resolve successfully
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const { result } = renderHook(() => useAuth());

    // Expect initial loading state
    expect(result.current.isLoading).toBe(true);

    // Wait for the hook to update after the promise resolves
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  test('should stop loading and keep user null on failed initial fetch', async () => {
    const mockError = new Error('Fetch failed');
    // Mock getUser to reject
    mockGetUser.mockRejectedValue(mockError);

    // Suppress console.error for this specific test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAuth());

    // Expect initial loading state
    expect(result.current.isLoading).toBe(true);

    // Wait for the hook to update after the promise rejects
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error fetching initial user:", mockError);
    expect(mockGetUser).toHaveBeenCalledTimes(1);

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('should update user when onAuthStateChange provides a session', async () => {
    const initialUser = null;
    const laterUser = { id: '456', email: 'later@example.com' } as User;
    const mockSession = { user: laterUser } as any; // Mock Session structure as needed

    // Mock initial getUser resolving with no user
    mockGetUser.mockResolvedValue({ data: { user: initialUser }, error: null });

    const { result } = renderHook(() => useAuth());

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull();

    // Simulate the onAuthStateChange callback being invoked with a new session
    act(() => {
      if (mockOnAuthStateChange.callback) {
        mockOnAuthStateChange.callback('SIGNED_IN', mockSession);
      }
    });

    // Assert that the user state has been updated
    expect(result.current.user).toEqual(laterUser);
    // Loading state should not change on subsequent auth updates
    expect(result.current.isLoading).toBe(false);
  });

  test('should set user to null when onAuthStateChange provides no session', async () => {
    const initialUser = { id: '789', email: 'initial@example.com' } as User;
    const mockSession = null; // Simulate sign out

    // Mock initial getUser resolving WITH a user
    mockGetUser.mockResolvedValue({ data: { user: initialUser }, error: null });

    const { result } = renderHook(() => useAuth());

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toEqual(initialUser);

    // Simulate the onAuthStateChange callback being invoked with null (sign out)
    act(() => {
      if (mockOnAuthStateChange.callback) {
        mockOnAuthStateChange.callback('SIGNED_OUT', mockSession);
      }
    });

    // Assert that the user state has been updated to null
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  test('should call unsubscribe on unmount', () => {
    // Mock getUser to resolve quickly
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { unmount } = renderHook(() => useAuth());

    // Ensure the subscription setup was called
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled(); // Should not be called yet

    // Unmount the component (which triggers the cleanup effect)
    unmount();

    // Assert that unsubscribe was called
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

}); 