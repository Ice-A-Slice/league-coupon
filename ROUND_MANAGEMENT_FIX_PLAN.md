# Round Management Service Fix Plan
*Goal: Make betting round creation competition-aware and scalable*

## Problem Summary
The `roundManagementService.ts` currently creates betting rounds by selecting fixtures from ALL competitions, causing issues when multiple competitions run simultaneously.

## Root Cause Analysis

### Current Flow:
1. Fixture sync triggers → `createBettingRoundFromFixtures()`
2. `identifyCandidateFixtures()` queries ALL unstarted fixtures across ALL competitions
3. Fixtures sorted by kickoff time (earliest first)
4. System picks earliest fixtures regardless of competition
5. Round inherits competition_id from selected fixtures

### Why It Fails:
- Icelandic league fixtures start Friday (earlier)
- Premier League fixtures start Saturday (later)
- System picks Icelandic fixtures first → creates Icelandic betting round

## Phase 1: Immediate Fix (Prevent Future Issues)

### 1.1 Make `identifyCandidateFixtures()` Competition-Aware

**File:** `src/services/roundManagementService.ts`
**Lines:** 395-451

```typescript
// BEFORE: 
async identifyCandidateFixtures(): Promise<Fixture[]> {

// AFTER:
async identifyCandidateFixtures(competitionId?: number): Promise<Fixture[]> {
```

**Changes needed:**
```typescript
// Add competition filter to the query
const { data: candidateFixturesData, error: queryError } = await supabase
  .from('fixtures')
  .select(`
    *,
    rounds!inner (
      season_id,
      seasons!inner (
        competition_id
      )
    )
  `)
  .eq('status_short', 'NS')
  .not('id', 'in', `(${existingFixtureIds.join(',')})`)
  // NEW: Add competition filter when provided
  .eq(competitionId ? 'rounds.seasons.competition_id' : 'id', competitionId || 'id');
```

### 1.2 Update Calling Functions

**File:** `src/services/roundManagementService.ts`
**Function:** `createBettingRoundFromFixtures()`

**Current issue:** No way to specify which competition to create rounds for.

**Solution:** Pass competition context through the call chain:

```typescript
// Add competition parameter
async createBettingRoundFromFixtures(competitionId: number): Promise<BettingRound> {
  // Pass to identifyCandidateFixtures
  const candidateFixtures = await this.identifyCandidateFixtures(competitionId);
  // ... rest of logic
}
```

### 1.3 Update API Endpoints

**Files to update:**
- Any API routes that trigger round creation
- Cron jobs that call round management

**Ensure:** Always pass the intended competition_id

## Phase 2: Database Schema Considerations

### 2.1 Add Competition Settings Table (Optional)
```sql
CREATE TABLE competition_settings (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id),
  auto_create_rounds BOOLEAN DEFAULT true,
  round_creation_window_hours INTEGER DEFAULT 72, -- How far ahead to look
  min_fixtures_per_round INTEGER DEFAULT 1,
  max_fixtures_per_round INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Add Round Creation Logs (Recommended)
```sql
CREATE TABLE round_creation_logs (
  id SERIAL PRIMARY KEY,
  competition_id INTEGER REFERENCES competitions(id),
  betting_round_id INTEGER REFERENCES betting_rounds(id),
  fixtures_count INTEGER,
  created_by VARCHAR(50), -- 'auto', 'manual', 'api'
  creation_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Phase 3: Enhanced Multi-Competition Support

### 3.1 Competition-Specific Round Creation Service

**New file:** `src/services/competitionRoundService.ts`

```typescript
export class CompetitionRoundService {
  async createRoundForCompetition(competitionId: number): Promise<BettingRound | null> {
    // 1. Check if competition is active
    // 2. Get competition settings
    // 3. Find available fixtures for this competition
    // 4. Create betting round if fixtures available
    // 5. Log the creation
  }
  
  async getActiveCompetitions(): Promise<Competition[]> {
    // Return competitions with is_current = true
  }
  
  async scheduleRoundCreation(): Promise<void> {
    // For each active competition, check if new rounds needed
  }
}
```

### 3.2 Update Cron Jobs

**Current:** Single cron job tries to create rounds for all competitions
**Better:** Separate job for each active competition

```typescript
// src/app/api/cron/create-rounds/route.ts
export async function GET() {
  const competitionService = new CompetitionRoundService();
  const activeCompetitions = await competitionService.getActiveCompetitions();
  
  for (const competition of activeCompetitions) {
    try {
      await competitionService.createRoundForCompetition(competition.id);
    } catch (error) {
      // Log error but continue with other competitions
    }
  }
}
```

## Phase 4: Testing & Validation

### 4.1 Unit Tests to Add
- `identifyCandidateFixtures()` with competition filter
- Multiple competitions running simultaneously
- Edge cases (no fixtures, single fixture, etc.)

### 4.2 Integration Tests
- Create rounds for Premier League only
- Create rounds for Icelandic league only
- Verify no cross-competition contamination

### 4.3 Database Validation Queries
```sql
-- Ensure no betting round has fixtures from multiple competitions
SELECT br.id, br.name, COUNT(DISTINCT s.competition_id) as competition_count
FROM betting_rounds br
JOIN betting_round_fixtures brf ON br.id = brf.betting_round_id  
JOIN fixtures f ON brf.fixture_id = f.id
JOIN rounds r ON f.round_id = r.id
JOIN seasons s ON r.season_id = s.id
GROUP BY br.id, br.name
HAVING COUNT(DISTINCT s.competition_id) > 1;
```

## Implementation Priority

### Priority 1 (This Week - Prevent Issues)
- [x] Fix immediate round 43 issue 
- [x] **TEMPORARY FIX APPLIED**: Hardcoded Premier League filter in `identifyCandidateFixtures()` 
- [ ] ⚠️  **TECH DEBT**: Remove hardcoded competition_id and implement proper competition-aware system
- [ ] Update `identifyCandidateFixtures()` to accept competition filter parameter
- [ ] Update calling code to pass competition_id dynamically

### Priority 2 (Next Sprint - Full Solution)
- [ ] Implement competition-specific round creation
- [ ] Add proper error handling and logging
- [ ] Update cron jobs to be competition-aware

### Priority 3 (Future Enhancement)
- [ ] Competition settings table
- [ ] Advanced scheduling logic
- [ ] Multi-competition dashboard

## Risk Mitigation

### Immediate Safeguards:
1. ✅ **Hard-coded Premier League filter** - APPLIED 2025-08-26
2. **Add validation** that betting rounds only contain fixtures from one competition
3. **Monitor round creation logs** closely

### ⚠️ TEMPORARY FIX STATUS:
- **Location**: `src/services/roundManagementService.ts:442`
- **What**: Hardcoded `competition_id = 1` (Premier League) 
- **Risk**: Will break if you want to support other competitions
- **TODO**: Replace with parameter-based approach before adding new competitions

### Long-term Protection:
1. **Database constraints** to prevent mixed-competition rounds
2. **Comprehensive testing** before any round creation changes
3. **Round creation audit trail**

## Files to Modify

### Phase 1 (Critical)
- `src/services/roundManagementService.ts` (lines 395-451, calling functions)
- Any cron job files that trigger round creation
- API routes that create betting rounds

### Phase 2 (Enhancement)  
- Database migration files
- `src/services/competitionRoundService.ts` (new)
- Updated test files

## Success Metrics
- ✅ No mixed-competition betting rounds created
- ✅ Each competition creates rounds independently  
- ✅ System scales to support multiple simultaneous competitions
- ✅ Clear audit trail for all round creation activities

---

**Next Steps:**
1. Implement Phase 1 changes (competition filter)
2. Test with both competitions running
3. Monitor for any edge cases
4. Plan Phase 2 implementation