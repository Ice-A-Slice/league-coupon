import type { Selections, SelectionType } from "@/components/BettingCoupon/types"; // Adjust path if necessary
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire"; // Correct import path for SeasonAnswers
import { getStoredSession } from '@/utils/auth/storage';

/**
 * Defines the structure for the data expected by the service function.
 */
interface SubmissionPayload {
  /** The betting coupon selections, mapping fixture ID to the selected outcome. */
  couponData: Selections;
  /** An array containing the answers to the season questionnaire. */
  answersData: SeasonAnswers[];
}

/**
 * Represents the standardized structure of API responses from the backend routes 
 * (/api/bets, /api/season-answers).
 * 
 * @todo Define a more specific type for the optional `data` field based on actual API responses, 
 * especially for `/api/season-answers` which returns upserted data.
 */
interface ApiResponse {
  /** A message indicating the outcome of the request (e.g., "Coupon submitted successfully"). */
  message: string;
  /** Optional data returned by the API (e.g., the data upserted by the season answers endpoint). */
  data?: unknown;   // Optional data field (returned by season-answers)
  /** An optional error message string if the request failed at the API level. */
  error?: string;   // Keep for consistency in error handling
}

/**
 * Defines the structure returned by `submitPredictions` upon successful submission 
 * of both coupon and answers.
 */
interface SubmissionSuccess {
  /** The API response object from the `/api/bets` endpoint. */
  betsResult: ApiResponse;
  /** The API response object from the `/api/season-answers` endpoint. */
  answersResult: ApiResponse;
}

/**
 * Submits the user's betting coupon selections and season answers to their respective backend API routes.
 * 
 * This function orchestrates two separate API calls:
 * 1. POST to `/api/bets` with the coupon selections.
 * 2. If the first call is successful, POST to `/api/season-answers` with the questionnaire answers.
 *
 * @param {SubmissionPayload} payload - An object containing the `couponData` (selections) and `answersData` (questionnaire answers).
 * @returns {Promise<SubmissionSuccess>} A promise that resolves with an object containing the API responses 
 *          from both endpoints (`betsResult` and `answersResult`) if both submissions are successful.
 * @throws {Error} Throws an error if either the bets submission or the answers submission fails. 
 *         The error message will indicate which part failed and include details from the API response if available. 
 *         Note: If the answers submission fails, the bets submission might have already succeeded.
 */
export async function submitPredictions(
  payload: SubmissionPayload
): Promise<SubmissionSuccess> {
  const { couponData, answersData } = payload;

  console.log('Submitting predictions with payload:', payload);

  // Use the placeholder type
  let betsResult: ApiResponse;
  let answersResult: ApiResponse;

  try {
    // 1. Submit Bets (Coupon Selections)
    console.log('Submitting coupon data...', couponData);
    const bets = Object.entries(couponData).map(([fixtureId, prediction]) => ({
      fixture_id: parseInt(fixtureId, 10),
      prediction: prediction as SelectionType,
    }));

    // Get auth token from localStorage using our auth utility
    const storedSession = getStoredSession();
    const authToken = storedSession?.access_token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const betsResponse = await fetch('/api/bets', {
      method: 'POST',
      headers,
      body: JSON.stringify(bets),
    });

    // Assume the response structure matches ApiResponse for now
    betsResult = await betsResponse.json(); 
    if (!betsResponse.ok) {
      console.error('Coupon submission failed:', betsResult);
      // Use the error message from the API response if available
      throw new Error(`Coupon submission failed: ${betsResult?.error || 'Unknown error'} (Status: ${betsResponse.status})`);
    }
    console.log('Coupon submission successful:', betsResult);

    // 2. Submit Season Answers (Questionnaire)
    // This proceeds only if bets submission was successful AND there are answers to submit
    if (answersData && answersData.length > 0) {
      console.log('Submitting season answers...', answersData);
      const answersResponse = await fetch('/api/season-answers', {
        method: 'POST',
        headers,
        body: JSON.stringify(answersData),
      });

      // Assume the response structure matches ApiResponse for now
      answersResult = await answersResponse.json();
      if (!answersResponse.ok) {
        console.error('Season answers submission failed:', answersResult);
        // Note: Bets might have succeeded, but answers failed. The error thrown here
        // indicates the overall submission process failed at this stage.
        throw new Error(`Season answers submission failed: ${answersResult?.error || 'Unknown error'} (Status: ${answersResponse.status})`);
      }
      console.log('Season answers submission successful:', answersResult);
    } else {
      console.log('No season answers to submit, skipping...');
      // Create a dummy success response when no answers are provided
      answersResult = {
        message: 'No season answers to submit',
        data: null
      };
    }

    // Both submissions succeeded
    return { betsResult, answersResult };

  } catch (error) {
    console.error('Submission service error:', error);
    // Re-throw the error to be caught by the calling component
    // Ensure the error is an actual Error object
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unexpected error occurred during submission.');
    }
  }
} 