# Betting Round Scoring Process

This document outlines the automated process for detecting completed betting rounds and scoring the associated user bets.

## Overview

The system automatically checks for completed betting rounds and processes their scoring hourly. This involves detecting when all fixtures in an 'open' round are finished, marking the round for scoring, calculating points for each user's bet, and finally marking the round as 'scored'. The process leverages a Vercel Cron job, a Next.js API route, a detection service, and a transactional PostgreSQL function called via RPC.

## Workflow Steps

1.  **Triggering (Vercel Cron)**
    *   A Vercel Cron job is configured in `vercel.json` with the schedule `0 * * * *` (hourly at minute 0).
    *   This job sends a GET request to the `/api/cron/process-rounds` endpoint.

2.  **Authentication (`/api/cron/process-rounds/route.ts`)**
    *   The API route first validates the request's `authorization` header.
    *   It checks if the provided Bearer token matches the `CRON_SECRET` environment variable.
    *   Unauthorized requests are rejected with a `401` status.

3.  **Round Completion Detection (`RoundCompletionDetectorService`)**
    *   The API route instantiates the `RoundCompletionDetectorService`.
    *   The service's `detectAndMarkCompletedRounds` method is called.
    *   **Detection Logic:**
        *   Queries the `betting_rounds` table for rounds with `status = 'open'`.
        *   For each open round, it checks the associated `fixtures` via the `betting_round_fixtures` table.
        *   A round is considered complete if *all* its linked fixtures have a status indicating completion (e.g., 'FT', 'AET', 'PEN', 'CANCELLED', 'AWARDED', 'POSTPONED', 'ABANDONED', 'WO').
    *   **Marking Logic:**
        *   If a round is detected as complete, its status in the `betting_rounds` table is updated to `'scoring'`.
        *   This status update prevents the same round from being picked up again by subsequent runs while it's being processed.
    *   The service returns a list of `roundId`s that were successfully marked for scoring and any errors encountered during detection/marking.

4.  **Scoring Orchestration (`/api/cron/process-rounds/route.ts`)**
    *   The API route iterates through the `roundId`s returned by the detector service.
    *   For each `roundId`, it calls the `calculateAndStoreMatchPoints` function (from `@/lib/scoring`).

5.  **Points Calculation & Storage (`calculateAndStoreMatchPoints` & RPC)**
    *   The `calculateAndStoreMatchPoints` function prepares the necessary data for the specific `roundId`.
    *   Crucially, it makes a Remote Procedure Call (RPC) to the PostgreSQL function `handle_round_scoring`, passing the `roundId`.
    *   Example RPC call:
        ```typescript
        const { error } = await supabaseClient.rpc('handle_round_scoring', {
          p_round_id: roundId
        });
        ```

6.  **Transactional Scoring (`handle_round_scoring` PostgreSQL Function)**
    *   This PL/pgSQL function executes the core scoring logic within a **single database transaction**.
    *   **Actions:**
        *   Retrieves fixture results and user bets for the given `p_round_id`.
        *   Calculates points for each bet based on the implemented scoring rules (exact score, correct result, etc.).
        *   Updates the `points_awarded` column in the `user_bets` table for each bet.
        *   Updates the `betting_rounds` table, setting the round's `status` to `'scored'`.
    *   **Transactionality:** Ensures that all bet updates and the final round status change succeed or fail together, maintaining data consistency.
    *   **Idempotency:** Includes checks (likely based on round status) to prevent accidental re-scoring of a round that is already `'scoring'` or `'scored'`.

7.  **Error Handling & Logging**
    *   **Detection Errors:** Errors during the detection/marking phase (Step 3) are logged by the API route, but the process continues to attempt scoring for any rounds successfully marked.
    *   **Scoring Errors:**
        *   Errors within `calculateAndStoreMatchPoints` before the RPC call are logged.
        *   Errors returned by the `handle_round_scoring` RPC call (e.g., transaction failures) are caught and logged by `calculateAndStoreMatchPoints` and propagated back to the API route.
        *   The API route logs scoring failures for specific rounds but continues processing other rounds in the batch.
    *   **Critical Errors:** Uncaught errors in the API route itself result in a `500` response.
    *   Comprehensive logging (using Pino via `@/utils/logger`) is implemented throughout the services and API route.

8.  **API Response**
    *   The `/api/cron/process-rounds` endpoint returns a JSON response summarizing the operation:
        ```json
        {
          "success": true,
          "message": "Processed X rounds.",
          "results": [
            { "roundId": 1, "success": true, "message": "Scoring completed.", "details": { "betsUpdated": 50 } },
            { "roundId": 2, "success": false, "message": "Scoring failed.", "details": { "error": "Database error during update." } }
            // ... other rounds
          ]
        }
        ```

## Key Files

*   `vercel.json`: Cron job configuration.
*   `src/app/api/cron/process-rounds/route.ts`: Main API endpoint orchestrating the flow.
*   `src/services/roundCompletionDetectorService.ts`: Logic for detecting completed rounds.
*   `src/lib/scoring.ts`: Contains `calculateAndStoreMatchPoints` which calls the RPC.
*   `supabase/migrations/<timestamp>_handle_round_scoring.sql`: SQL definition of the `handle_round_scoring` function (assuming migration file exists). 