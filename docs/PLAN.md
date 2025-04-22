# API Integration and Database Plan

This document outlines the strategy for integrating the api-football data API and setting up the initial Supabase database structure for the Football Prediction App.

## 1. Core Goal

Integrate external football data (leagues, seasons, fixtures, teams, players, standings) to power the prediction application, replacing initial dummy data.

## 2. Data Strategy

*   **Source:** Use the api-football (v3.football.api-sports.io) API.
*   **Storage:** Fetch data from the API periodically and store/cache it locally in the project's Supabase database. The application will primarily read from the local Supabase tables for performance and resilience.
*   **Synchronization:** A background process (e.g., Supabase Edge Function, scheduled script) will be needed to keep the local database synchronized with the API (handling new data, updates to scores, statuses, etc.). This will be implemented *after* initial data fetching is working.

## 3. Key Features to Support

*   Weekly betting on fixtures (1X2).
*   Season-long prediction questions (League Winner, Last Place, Best Goal Difference, Top Scorer).
*   Support for multiple leagues (e.g., Premier League, Allsvenskan) and multiple seasons (e.g., 2024, 2024/25).
*   Hall of Fame for season winners.

## 4. Incremental Implementation Plan

*(Focus: Slow is smooth, smooth is fast)*

1.  **Define API Types:** Create TypeScript interfaces for the expected API responses (`/countries`, `/leagues`, `/fixtures`, `/teams`, `/players`, `/standings`). (✓ Partially done for countries, leagues, fixtures).
2.  **Implement Fixture Fetching:** Write the core client function(s) in `src/services/football-api/` to fetch fixture data for a given league and season using the defined types. Handle API key authentication securely (using environment variables).
3.  **Initial Database Setup:** Create the core Supabase tables based on the proposed schema (see conversation history), focusing initially on `users`, `competitions`, `seasons`, `teams`, `rounds`, `fixtures`.
4.  **Populate Initial Data:** Write a script or function to perform an initial fetch from the API (e.g., for Premier League 2024/25 fixtures) and populate the corresponding Supabase tables.
5.  **Connect UI (Fixtures):** Update the betting coupon UI to display fixtures fetched from the local Supabase database.
6.  **Implement Team/Player Fetching:** Define types and write fetch functions for `/teams` and `/players`. Populate corresponding database tables.
7.  **Connect UI (Season Questions):** Update the season question UI to populate dropdowns with teams/players fetched from the local Supabase database.
8.  **Implement Standings/Top Scorer Fetching:** Define types and write fetch functions for `/standings` and potentially player statistics/top scorers.
9.  **Implement Betting Logic:** Add logic to save user bets (`user_bets` table) and season predictions (`user_season_predictions` table).
10. **Implement Points Calculation:** Develop the logic to calculate points based on fixture results and standings/top scorers, updating `user_bets.points_awarded` and `user_season_predictions.current_points`. Populate `points_log`.
11. **Implement Synchronization:** Build the background process to keep local data updated from the API.
12. **Refine Round Logic:** Implement the custom 3-day gap rule for round definitions/deadlines if needed, based on fixture kickoff times.
13. **Hall of Fame:** Implement logic to determine season winners and populate the `season_winners` table.

## 5. Project Structure

*   API client code and types reside in `src/services/football-api/`.
*   Database interaction logic (Supabase client calls) likely in `src/lib/supabase/` or similar.
*   Core application types (if needed, distinct from API types) in `src/types/`.

## 6. Key Considerations

*   Handle API key securely using `.env.local` (and ensure it's in `.gitignore`).
*   Implement robust error handling and data validation when interacting with the API.
*   Design database schema with multi-league and multi-season support from the start.
*   Use Git feature branches (e.g., `feature/integrate-api-football`) for development. Commit progress frequently. 