import { submitPredictions } from "@/services/submissionService";
import type { User } from "@supabase/supabase-js";
import type { SelectionType } from "@/components/BettingCoupon/types";
import { useState, useCallback } from "react";
import type { SeasonAnswers } from "@/components/Questionnaire/Questionnaire";

/**
 * Represents the data required for a coupon submission.
 */
export interface CouponSubmissionData {
  userId: string;
  selections: Record<string, SelectionType>;
  answers?: SeasonAnswers[];
}

/**
 * Defines the return shape of the useSubmission hook.
 */
interface UseSubmissionReturn {
  submitCoupon: (data: CouponSubmissionData) => Promise<void>;
  isSubmitting: boolean;
  submissionError: Error | null;
}

/**
 * Custom hook for handling coupon submissions.
 *
 * Provides a function to submit the coupon data and manages the submission state,
 * including loading and error handling.
 *
 * @param {User | null} user - The currently authenticated user object, or null if not authenticated.
 * @returns An object containing the submission function and state.
 * @property {Function} submitCoupon - Function to initiate the coupon submission process.
 * @property {boolean} isSubmitting - Indicates if a submission is currently in progress.
 * @property {Error | null} submissionError - Stores any error object encountered during submission, otherwise null.
 */
export function useSubmission(user: User | null): UseSubmissionReturn {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<Error | null>(null);

  const submitCoupon = useCallback(async (submissionData: CouponSubmissionData) => {
    if (!user) {
      setSubmissionError(new Error("User not authenticated."));
      return;
    }
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      await submitPredictions({
        couponData: submissionData.selections,
        answersData: submissionData.answers ?? []
      });
      console.log("Submission successful via useSubmission hook!");
    } catch (e) {
      const error = e instanceof Error ? e : new Error("An unknown submission error occurred");
      setSubmissionError(error);
      console.error("Submission failed via useSubmission hook:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [user]);

  return { submitCoupon, isSubmitting, submissionError };
} 