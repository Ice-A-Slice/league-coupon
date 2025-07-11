# Product Requirements Document: Last Round Special

## Executive Summary

The Last Round Special is a parallel cup competition that activates automatically during the final phase of the main season. This feature maintains user engagement by providing a fresh competition for players who may no longer be competitive in the main season standings.

## Background & Context

### Current Problem
- Users lose interest in the main season when they fall too far behind in standings
- Engagement drops significantly in the final rounds of the season
- No mechanism to re-engage users who are out of contention

### Historical Context
- Feature has been successfully run manually for years (2015-16, 2020-21, 2021-22)
- Proven to increase engagement during final season phases
- Creates additional competitive opportunities and winner categories

### Success Examples
- **2015-16**: League Winner (Aron Kristinsson) ≠ Last Round Winner (Laurentiu Scheusan)
- **2021-22**: Double Winner (Heimir Þorsteinsson won both competitions)
- **2020-21**: Separate winners created additional excitement

## Feature Overview

### Core Concept
A parallel cup competition that:
- Activates automatically when ~5 rounds remain in the season
- Resets all users to 0 points for the cup competition
- Uses the same betting interface and fixtures as the main season
- Tracks separate points without dynamic points system
- Determines separate cup winners
- Integrates with Hall of Fame system

### Key Benefits
1. **Sustained Engagement**: Keeps all users competitive until season end
2. **Fresh Competition**: New scoring opportunity regardless of main season position
3. **Dual Winners**: Creates more championship opportunities
4. **Automated Operation**: Reduces manual administration overhead

## Technical Requirements

### Activation Logic
- **Trigger Condition**: 60% or more teams have ≤5 games remaining
- **Frequency**: Check daily via cron job
- **Idempotency**: Ensure activation only occurs once per season
- **Logging**: Comprehensive logging of activation decisions

### Data Model Changes

#### Extended Existing Tables
```sql
-- Add Last Round Special tracking to seasons table
ALTER TABLE seasons ADD COLUMN last_round_special_activated BOOLEAN DEFAULT FALSE;
ALTER TABLE seasons ADD COLUMN last_round_special_activated_at TIMESTAMP WITH TIME ZONE;

-- Add competition type to season_winners table
ALTER TABLE season_winners ADD COLUMN competition_type VARCHAR(50) DEFAULT 'league';
-- Values: 'league', 'last_round_special'
```

#### New Table for Cup Points
```sql
-- Dedicated table for cup points (clean separation from main scoring)
CREATE TABLE user_last_round_special_points (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    betting_round_id INTEGER REFERENCES betting_rounds(id),
    season_id INTEGER REFERENCES seasons(id),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, betting_round_id, season_id)
);

-- Add indexes for performance
CREATE INDEX idx_user_last_round_special_points_user_season 
ON user_last_round_special_points(user_id, season_id);

CREATE INDEX idx_user_last_round_special_points_season 
ON user_last_round_special_points(season_id);
```

#### Database Schema Benefits
- **Clean Separation**: Cup points don't pollute existing scoring tables
- **Reuse Winner Logic**: `season_winners` handles both league and cup winners
- **Minimal Changes**: Only extends existing tables where necessary
- **Future-Proof**: Easy to add cup-specific features without affecting main system

### Scoring System
- **Point Calculation**: Same as main season but without dynamic points
- **Scoring Logic**: Standard game prediction points only (from `user_bets.points_awarded`)
- **Reset Mechanism**: All users start at 0 when cup activates
- **Tie Handling**: Multiple winners allowed (same as main season)

### Integration Points

#### Existing Systems
- **Betting Interface**: Same fixtures and betting forms
- **Scoring Service**: Extended to calculate cup points
- **Winner Determination**: Reuse existing logic with competition_type filter
- **Hall of Fame**: Query `season_winners` with both competition types
- **Email System**: Notifications for cup activation and results

#### New Services
- **Cup Activation Service**: Monitors fixtures and triggers activation
- **Cup Scoring Service**: Calculates and stores cup points
- **Cup Winner Service**: Determines cup winners using existing pattern

## User Experience Design

### UI/UX Flow

#### Pre-Activation
- **Standings Page**: Only main season standings visible
- **No Cup Tab**: Last Round Special tab remains hidden

#### Activation Moment
- **Notification**: Email notification about cup activation
- **UI Update**: Last Round Special tab becomes visible
- **Announcement**: Clear messaging about new competition

#### During Cup Period
- **Tab Navigation**: Easy switching between Season and Cup standings
- **Betting Interface**: Same interface, points tracked for both competitions
- **Clear Indicators**: Visual cues showing which competition is active

#### Post-Season
- **Hall of Fame**: Both winners displayed
- **Historical Data**: Cup results preserved for future reference

### Key User Flows

#### Flow 1: Cup Activation
1. User visits standings page (main season only visible)
2. System detects activation trigger
3. User receives email notification
4. User returns to app, sees new "Last Round Special" tab
5. User can now track progress in both competitions

#### Flow 2: Dual Competition Betting
1. User navigates to betting interface
2. User makes predictions (same as always)
3. System calculates points for both competitions
4. User can view progress in both Season and Cup tabs

#### Flow 3: Winner Determination
1. Season ends
2. System determines main season winner
3. System determines cup winner (separate calculation)
4. Both winners announced via email
5. Hall of Fame updated with both wins

### Mobile Considerations
- **Tab Navigation**: Optimized for mobile switching
- **Push Notifications**: Cup activation and winner announcements
- **Responsive Design**: Both standings tables mobile-friendly

## Technical Implementation

### Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cup Detector  │    │  Cup Activator  │    │  Cup Scoring    │
│   (Cron Job)    │────▶│   (Service)     │────▶│   (Service)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Fixture Data   │    │  Notifications  │    │  Standings API  │
│  (Teams Left)   │    │   (Email)       │    │   (Enhanced)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### API Endpoints

#### New Endpoints
- `GET /api/last-round-special/status` - Check if cup is active for current season
- `GET /api/last-round-special/standings` - Cup standings with user rankings
- `GET /api/last-round-special/winners/:seasonId` - Cup winners for specific season
- `POST /api/admin/last-round-special/activate` - Manual activation (future enhancement)

#### Modified Endpoints
- `GET /api/standings` - Include cup standings when active
- `GET /api/hall-of-fame` - Include both competition types in winner data

### Example Queries

#### Cup Standings Query
```sql
-- Get current cup standings
SELECT 
  p.id,
  p.full_name,
  p.avatar_url,
  COALESCE(SUM(ulrs.points), 0) as total_points,
  COUNT(ulrs.betting_round_id) as rounds_played
FROM profiles p
LEFT JOIN user_last_round_special_points ulrs ON p.id = ulrs.user_id 
  AND ulrs.season_id = ?
GROUP BY p.id, p.full_name, p.avatar_url
ORDER BY total_points DESC, p.full_name;
```

#### Winner Determination Query
```sql
-- Find cup winners (handle ties)
WITH cup_standings AS (
  SELECT 
    user_id,
    SUM(points) as total_points
  FROM user_last_round_special_points
  WHERE season_id = ?
  GROUP BY user_id
),
max_points AS (
  SELECT MAX(total_points) as max_points
  FROM cup_standings
)
SELECT cs.user_id, cs.total_points
FROM cup_standings cs
CROSS JOIN max_points mp
WHERE cs.total_points = mp.max_points;
```

### Cron Jobs
- **Cup Detection**: Daily check for activation conditions
- **Cup Scoring**: Process cup points after each round (integrate with existing scoring)
- **Cup Winner Determination**: Triggered at season end

## Success Metrics

### Key Performance Indicators
1. **User Engagement**: 
   - Target: 85% of users remain active after cup activation
   - Measurement: Daily active users during cup period

2. **Betting Activity**:
   - Target: Maintain 90% betting participation rate
   - Measurement: Bets placed per user during cup period

3. **Feature Adoption**:
   - Target: 95% of users view cup standings at least once
   - Measurement: Cup tab visits and interaction rates

4. **System Reliability**:
   - Target: 99.5% uptime during cup period
   - Measurement: API response times and error rates

### Success Criteria
- [ ] Cup activates automatically within 24 hours of trigger condition
- [ ] All users can access cup standings immediately after activation
- [ ] Betting interface works seamlessly for both competitions
- [ ] Cup winners are determined and announced correctly
- [ ] Hall of Fame integration displays both win types
- [ ] Email notifications are sent for all key events
- [ ] Mobile experience maintains full functionality

## Risk Assessment

### Technical Risks
- **Data Consistency**: Ensuring cup points are calculated correctly
- **Performance**: Additional scoring calculations may impact response times
- **Migration**: Database schema changes require careful deployment

### Mitigation Strategies
- **Comprehensive Testing**: Unit and integration tests for all scoring logic
- **Performance Monitoring**: Track API response times during cup periods
- **Gradual Rollout**: Deploy to staging environment first
- **Database Separation**: Clean table structure reduces risk to existing systems

### Rollback Plan
- **Database Rollback**: Prepared migration rollback scripts
- **Feature Toggle**: Ability to disable cup activation if issues arise
- **Minimal Impact**: New table structure isolated from existing scoring

## Future Enhancements

*Note: These items have been added to the project backlog for future consideration*

- **Manual Admin Override**: Administrative controls for cup activation
- **Advanced Fixture Logic**: Enhanced activation logic considering fixture density
- **Enhanced UI/UX**: Improved visual indicators and mobile optimization
- **Historical Analytics**: Detailed cup performance tracking and analytics

## Conclusion

The Last Round Special feature represents a significant enhancement to user engagement and competitive experience. By automating a proven manual process, we can provide consistent value to users while reducing administrative overhead. 

The refined database approach ensures clean separation of concerns while reusing existing infrastructure where appropriate. This minimizes risk to existing systems while providing the flexibility needed for future enhancements.

The phased approach ensures we deliver core functionality first while maintaining the ability to evolve the feature based on user feedback and usage patterns. 