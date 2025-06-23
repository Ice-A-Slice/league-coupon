# Backlog Task: Season is_current Flag Management

## Problem
Currently, multiple seasons in the `seasons` table can have the `is_current` flag set to `TRUE` for the same competition. This can cause confusion in the application about which season is active, especially when a season has ended but is still marked as current.

## Task Description
- Ensure that only one season per competition has `is_current = TRUE` at any given time.
- When a season's `end_date` has passed, automatically set its `is_current` flag to `FALSE`.
- When a new season is about to start (or starts), set its `is_current` flag to `TRUE` and set all other seasons for that competition to `FALSE`.
- Update the application logic or add a scheduled job/script to enforce this rule.
- Optionally, fetch and update season start/end dates and other metadata from the external football API to keep the database accurate.

## Acceptance Criteria
- No two seasons for the same competition have `is_current = TRUE` at the same time.
- The current season is always the one with `is_current = TRUE` and a valid date range.
- The process is automated or clearly documented for manual updates. 