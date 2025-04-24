import type { Selections, SelectionType } from "@/components/BettingCoupon/types"; // Adjust path if necessary
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire"; // Correct import path for SeasonAnswers

// Define the structure for the data expected by the service function
interface SubmissionPayload {
  couponData: Selections;
  answersData: SeasonAnswers[];
}

// Define a potential structure for the success response (can be customized)
interface SubmissionSuccess {
  betsResult: any; // Replace 'any' with specific type if known
  answersResult: any; // Replace 'any' with specific type if known
}

/**
 * Submits the user's betting coupon selections and season answers to the backend API.
 *
 * @param payload - An object containing the couponData and answersData.
 * @returns A promise that resolves with the results on success.
 * @throws An error if any part of the submission fails.
 */
export async function submitPredictions(
  payload: SubmissionPayload
): Promise<SubmissionSuccess> {
  const { couponData, answersData } = payload;

  console.log('Submitting predictions with payload:', payload);

  let betsResult: any;
  let answersResult: any;

  try {
    // 1. Submit Bets (Coupon Selections)
    console.log('Submitting coupon data...', couponData);
    const bets = Object.entries(couponData).map(([fixtureId, prediction]) => ({
      fixture_id: parseInt(fixtureId, 10),
      prediction: prediction as SelectionType,
    }));

    const betsResponse = await fetch('/api/bets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bets),
    });

    betsResult = await betsResponse.json();
    if (!betsResponse.ok) {
      console.error('Coupon submission failed:', betsResult);
      // Use the error message from the API response if available
      throw new Error(`Coupon submission failed: ${betsResult?.error || 'Unknown error'} (Status: ${betsResponse.status})`);
    }
    console.log('Coupon submission successful:', betsResult);

    // 2. Submit Season Answers (Questionnaire)
    // This proceeds only if bets submission was successful
    console.log('Submitting season answers...', answersData);
    const answersResponse = await fetch('/api/season-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answersData),
    });

    answersResult = await answersResponse.json();
    if (!answersResponse.ok) {
      console.error('Season answers submission failed:', answersResult);
      // Note: Bets might have succeeded, but answers failed. The error thrown here
      // indicates the overall submission process failed at this stage.
      throw new Error(`Season answers submission failed: ${answersResult?.error || 'Unknown error'} (Status: ${answersResponse.status})`);
    }
    console.log('Season answers submission successful:', answersResult);

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