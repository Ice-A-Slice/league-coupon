import { submitPredictions } from './submissionService';
import type { Selections } from '@/components/BettingCoupon/types';
import type { SeasonAnswers } from '@/components/Questionnaire/Questionnaire';

// Mock the global fetch function
global.fetch = jest.fn();

// Define fetchMock at the top level for accessibility within describe block
const fetchMock = global.fetch as jest.Mock;

// Sample data
// ... (keep existing mock data) ...
const mockCouponData: Selections = {
  '101': '1',
  '102': '2'
};
const mockAnswersData: SeasonAnswers[] = [
  { question_type: 'league_winner', answered_team_id: 1, answered_player_id: null },
  { question_type: 'last_place', answered_team_id: 20, answered_player_id: null },
  { question_type: 'best_goal_difference', answered_team_id: 5, answered_player_id: null },
  { question_type: 'top_scorer', answered_team_id: null, answered_player_id: 150 }
];

const mockPayload = {
  couponData: mockCouponData,
  answersData: mockAnswersData,
};

describe('Submission Service', () => {

  beforeEach(() => {
    // Reset fetch mock before each test
    // fetchMock is already defined in the outer scope
    fetchMock.mockClear();
    // Reset console mocks if used
    jest.restoreAllMocks();
  });

  test('should submit both bets and answers successfully', async () => {
    // Mock successful responses matching the refined ApiResponse
    const mockBetsResult = { message: 'Bets submitted successfully!' }; 
    const mockAnswersResult = { message: 'Answers saved successfully', data: mockAnswersData }; // Include data for answers

    fetchMock
      .mockResolvedValueOnce({ // Bets API call
        ok: true,
        json: async () => mockBetsResult,
        status: 200, statusText: 'OK'
      })
      .mockResolvedValueOnce({ // Answers API call
        ok: true,
        json: async () => mockAnswersResult,
        status: 200, statusText: 'OK'
      });

    const result = await submitPredictions(mockPayload);

    expect(result).toEqual({ betsResult: mockBetsResult, answersResult: mockAnswersResult });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/bets', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/season-answers', expect.objectContaining({ method: 'POST' }));
  });

  test('should throw error if bets submission fails', async () => {
    // Mock failed response, ensure it includes an error property if possible
    const errorMsg = 'Bets API error';
    const mockErrorResponse = { error: errorMsg }; // Simulate error structure
    fetchMock.mockResolvedValueOnce({ // Bets API call - FAILS
      ok: false,
      json: async () => mockErrorResponse,
      status: 400, statusText: 'Bad Request'
    });

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Expect the function to throw
    await expect(submitPredictions(mockPayload)).rejects.toThrow(
      `Coupon submission failed: ${errorMsg} (Status: 400)`
    );

    // Ensure only the first API was called
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/bets', expect.any(Object));
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test('should throw error if answers submission fails after bets succeed', async () => {
    // Bets success mock matching ApiResponse
    const betsSuccessResult = { message: 'Bets saved successfully' }; 
    const answersErrorMsg = 'Answers API error';
    const mockErrorResponse = { error: answersErrorMsg }; // Simulate error structure

    fetchMock
      .mockResolvedValueOnce({ // Bets API call - SUCCEEDS
        ok: true,
        json: async () => betsSuccessResult,
        status: 200, statusText: 'OK'
      })
      .mockResolvedValueOnce({ // Answers API call - FAILS
        ok: false,
        json: async () => mockErrorResponse,
        status: 500, statusText: 'Server Error'
      });

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Expect the function to throw
    await expect(submitPredictions(mockPayload)).rejects.toThrow(
      `Season answers submission failed: ${answersErrorMsg} (Status: 500)`
    );

    // Ensure both APIs were called
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/bets', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/season-answers', expect.any(Object));
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

});
