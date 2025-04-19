# Product Requirements Document: Coupon & Questionnaire Validation

**Version:** 1.0
**Date:** 2024-07-27

## 1. Introduction

This document outlines the requirements for implementing comprehensive validation for the Betting Coupon and Questionnaire components within the TippSlottet application. The goal is to ensure users submit complete and valid data for both sections before the form can be processed.

## 2. Goals

-   Ensure all matches in the `BettingCoupon` have a selection ('1', 'X', or '2').
-   Ensure all questions in the `Questionnaire` are answered.
-   Provide clear, user-friendly validation feedback for both components.
-   Implement validation using the Zod library for robustness and type safety.
-   Consolidate validation checks at the main page level (`page.tsx`) before submission.

## 3. Functional Requirements

### 3.1. Betting Coupon Validation (`BettingCoupon.tsx`)

-   **Requirement:** Every match presented in the coupon *must* have a selection ('1', 'X', or '2').
-   **Implementation:**
    -   Define a Zod schema that represents the `Selections` type.
    -   The schema must ensure that for a given list of `matches`, the `Selections` object contains a valid key (match ID) for *each* match, and the value for each key is one of '1', 'X', or '2'.
    -   Implement a validation function within or related to `BettingCoupon` that uses this Zod schema to validate the current `selections` state against the provided `matches` prop.
    -   This function should return a boolean indicating validity and potentially an array of error messages or an error object mapping match IDs to errors (TBD during implementation).

### 3.2. Questionnaire Validation (`Questionnaire.tsx`)

-   **Requirement:** All prediction fields (`leagueWinner`, `lastPlace`, `bestGoalDifference`, `topScorer`) *must* have a non-null value selected.
-   **Implementation:**
    -   Define a Zod schema for the `Prediction` type.
    -   The schema must ensure all fields are non-null (or potentially check for valid string IDs depending on how `null` vs. actual IDs are handled).
    -   Refactor the existing `validatePredictions` function within `Questionnaire.tsx` to use this Zod schema.
    -   The function should continue to return a boolean indicating validity and update the internal `errors` state for displaying feedback within the component.

### 3.3. Page-Level Submission Validation (`page.tsx`)

-   **Requirement:** The main "Submit" button must trigger validation for *both* the Betting Coupon and the Questionnaire (if visible/active). Submission should only proceed if *both* components are valid.
-   **Implementation:**
    -   The `handleSubmit` function in `page.tsx` needs to be updated.
    -   It should call the validation function from `BettingCoupon` (needs to be exposed, possibly via a ref similar to `Questionnaire`).
    -   It should continue to call the `validatePredictions` function from `Questionnaire` via its ref.
    -   Aggregate any validation errors from both components.
    -   Display all validation errors clearly to the user (e.g., in the existing error display area).
    -   Prevent the submission logic (logging to console, setting `isSubmitted` to true) if any validation errors exist from either component.

## 4. Technical Requirements

-   **Library:** Use Zod for all schema definitions and validation logic.
-   **Best Practices:** Implementation should follow established Zod best practices, including the use of `.safeParse()` for validation and `z.infer` for type derivation.
-   **Error Handling:** Validation errors should be clearly presented to the user, indicating which specific fields or matches are invalid.
-   **TypeScript:** All code should adhere to strict TypeScript standards, leveraging Zod's type inference capabilities.

## 5. Out of Scope

-   Backend validation (this PRD focuses solely on client-side validation).
-   UI design changes beyond displaying validation errors.
-   Validation rules other than completeness checks described above. 