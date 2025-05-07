# Product Requirements Document: Dynamic Points & Enhanced Standings

## 1. Introduction

This document outlines the requirements for implementing a dynamic questionnaire-based scoring system and enhancing the user standings display. The goal is to introduce a new layer of engagement by awarding points based on users' predictions for season-long outcomes (e.g., league winner), with these points being re-evaluated after each betting round.

## 2. Goals

*   Implement a system to calculate and award points based on users' answers to four predefined season-long questions.
*   Ensure these "dynamic questionnaire points" are re-calculated and updated after each betting round is scored.
*   Modify the existing standings calculation logic to incorporate these dynamic points.
*   Update the database schema to store both accumulated game points and current dynamic questionnaire points.
*   (Optional - P2) Enhance the frontend to display separate point totals (game, questionnaire) and a combined total in the user standings/leaderboard.

## 3. User Stories

*   As a user, I want to answer four predefined questions about season outcomes at the start of the season so that I can earn additional points throughout the season.
*   As a user, I want my answers to these questions to be evaluated after each betting round, and awarded points if my predictions are currently correct, so I can see my dynamic score change.
*   As a user, I want to see my total accumulated game points, my current dynamic questionnaire points for the latest round, and my overall total points in the standings.

## 4. Functional Requirements

### 4.1. Questionnaire & Predictions

*   **FR1.1 Fixed Questions:** There will be four (4) predefined, hardcoded questions for the season:
    1.  Who will win the league?
    2.  Who will be the top scorer?
    3.  Which team will have the best goal difference?
    4.  Which team will finish in last place?
*   **FR1.2 User Answers:** Users will provide their answers to these four questions once, typically at the start of a season or when joining. (The mechanism for collecting these answers is out of scope for this PRD but assumed to exist).
*   **FR1.3 Answer Storage:** User answers to these questions must be stored persistently. (Assume a table like `user_season_predictions` with `user_id`, `season_id`, `question_1_answer`, `question_2_answer`, etc.)

### 4.2. Dynamic Questionnaire Point Calculation

*   **FR2.1 Calculation Timing:** Dynamic questionnaire points will be calculated **during the `process-rounds` cron job**, specifically after a betting round's game bets have been scored and that round is marked 'scored'.
*   **FR2.2 Points Per Question:** Each correctly answered question (based on the current state of the league/competition *after* the just-scored round) awards **3 points**.
*   **FR2.3 Total Dynamic Points:** A user can earn a maximum of 12 dynamic questionnaire points per round (4 questions x 3 points).
*   **FR2.4 Non-Cumulative Nature:** These points are **not cumulative round over round**. They represent a "snapshot" of correctness based on the league's state after the most recently scored betting round. If a user was correct in round 3 but incorrect in round 4 for the same question, they get 0 points for that question in round 4.
*   **FR2.5 Data Sources for Verification:**
    *   League Winner: Current 1st place team in the official league table.
    *   Top Scorer: Current top scorer(s) in the official league statistics.
    *   Best Goal Difference: Team with the highest goal difference in the official league table.
    *   Last Place: Team in the last position in the official league table.
    *   (Assumption: Mechanisms to fetch/query this live league data will be implemented or are available.)

### 4.3. Standings Data & Logic

*   **FR3.1 Points Storage:**
    *   The `user_bets` table (or a similar aggregated table) will continue to store `points_awarded` for individual game predictions. The sum of these for a user represents their "accumulated game points."
    *   A new storage mechanism is needed for the "current dynamic questionnaire points." This could be a new table (e.g., `user_round_dynamic_points` with `user_id`, `betting_round_id`, `dynamic_points`) or by adding a column to an existing user summary table if one is created for standings. The key is that it stores the *latest calculated dynamic points* for each user, tied to the last processed betting round.
*   **FR3.2 Overall Standings Calculation:**
    *   The `calculateStandings` service/function (currently implemented in `standingsService.ts`) will be modified.
    *   It will first calculate/retrieve total **accumulated game points** for each user (as it does now by calling `get_user_total_points` RPC).
    *   It will then fetch the **current dynamic questionnaire points** for each user (for the most recently scored round).
    *   The **total points** for ranking will be `accumulated_game_points + current_dynamic_questionnaire_points`.
    *   Ranking logic (sorting, tie-breaking) will apply to this combined total.
*   **FR3.3 API for Standings:** An API endpoint will expose the standings data, including:
    *   `user_id`
    *   `accumulated_game_points`
    *   `current_dynamic_questionnaire_points`
    *   `total_combined_points`
    *   `rank`

### 4.4. (P2 - Optional) Frontend Display

*   **FR4.1 Leaderboard Update:** The frontend leaderboard/standings page will be updated to display:
    *   A column for "Game Points" (accumulated).
    *   A column for "Questionnaire Points" (current dynamic).
    *   A column for "Total Points."
    *   Users ranked by "Total Points."

## 5. Non-Functional Requirements

*   **NFR1 Performance:** Calculation of dynamic points and overall standings should be efficient and not significantly degrade the performance of the `process-rounds` cron job.
*   **NFR2 Scalability:** The system should handle an increasing number of users and betting rounds.
*   **NFR3 Data Integrity:** Point calculations must be accurate and consistently applied.
*   **NFR4 Testability:** Logic for dynamic point calculation and standings must be unit-testable.

## 6. Out of Scope

*   The UI/UX for users to initially submit their answers to the four season-long questions.
*   Historical tracking of dynamic questionnaire points across multiple previous rounds (only the latest is required for current standings).
*   User interface for viewing which specific questions a user got right/wrong for their dynamic points.
*   Admin interface for managing questions or dynamic points.
*   Real-time "live" updates of dynamic points as league games are in progress (updates happen only after a betting round is fully scored).

## 7. Technical Considerations

*   Database schema modifications will be necessary.
*   The `process-rounds` cron job logic in `RoundCompletionDetectorService` and `calculateAndStoreMatchPoints` (or a new service called by it) will need to be extended to trigger questionnaire point calculation.
*   The `standingsService.ts` will require significant modification.
*   Access to up-to-date league table data (positions, goal differences, top scorers) is crucial. This might involve new API calls or database tables updated by another process.

## 8. Success Metrics

*   Successful calculation and storage of dynamic questionnaire points after each round.
*   Correct aggregation of game points and dynamic points for total user scores.
*   Accurate ranking of users based on the combined total points.
*   (P2) Frontend successfully displays the new point categories in the standings. 