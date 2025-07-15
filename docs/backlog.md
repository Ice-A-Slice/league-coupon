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

---

# Backlog Task: Last Round Special - Phase 2 Enhancements

## Problem
The initial Last Round Special implementation will use simple majority-based activation logic. Future enhancements are needed to improve accuracy and provide administrative control.

## Task Description - Manual Admin Override
- **Priority**: Medium
- **Dependency**: Requires broader admin panel development
- **Description**: Add manual controls for administrators to:
  - Override automatic Last Round Special activation
  - Force activate/deactivate the cup competition
  - Set custom activation dates
  - Review and approve automatic trigger decisions before activation

## Task Description - Advanced Fixture Density Logic
- **Priority**: Low
- **Dependency**: Requires real-world usage data and feedback
- **Description**: Enhance the activation logic to consider:
  - Fixture density (games spread over time vs compressed schedule)
  - Weighted team analysis (not just simple majority)
  - Rescheduling impact analysis
  - Machine learning-based prediction of optimal activation timing

## Task Description - Enhanced UI/UX
- **Priority**: Medium
- **Dependency**: User feedback from Phase 1 implementation
- **Description**: Improve the user interface with:
  - Better visual indicators for dual competitions
  - Historical Last Round Special performance tracking
  - Improved standings display with both competitions
  - Mobile-optimized dual competition view
  - Push notifications for cup activation

## Acceptance Criteria
- Admin panel provides full control over Last Round Special activation
- Enhanced logic improves activation accuracy by 20%+ compared to simple majority
- UI improvements increase user engagement during cup periods
- All features maintain backward compatibility with Phase 1 implementation 