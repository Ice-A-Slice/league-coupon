# Test Failure Debugging Guide - Updated Status

## Current Situation (LATEST UPDATE)

**Status**: 15 failing tests across 3 test suites ✅ **CONTINUED PROGRESS**
- Started with: 22 failing tests in 2 suites
- After first attempt: 32 failing tests in 3 suites (made worse)
- After debugging team round 1: 19 failing tests in 3 suites (4 tests fixed)
- **After debugging team round 2: 15 failing tests in 3 suites** ✅ **4 more tests fixed!**

### ✅ What the Debugging Team Successfully Fixed
- **Cascading test failures** - Tests no longer corrupt each other's database state  
- **Auth user cleanup** - Improved cleanup mechanisms between tests
- **Sequential execution** - Prevented race conditions with mutex implementation
- **Unique email generation** - Avoided auth user conflicts
- **Additional fixes** - 4 more tests passing since last round

## Remaining Issues Analysis - 15 Failing Tests

**❌ Note**: The debugging team reported "0 critical failures" but the test output shows 15 tests still failing. The actual status is:

### Test Suite Breakdown:
1. **`tests/utils/db.test.ts`** - **1 failing test** ✅ (improved from 3!)
2. **`src/services/winnerDeterminationService.test.ts`** - **5 failing tests** ✅ (improved from 7!)  
3. **`src/services/cup/__tests__/cupWinnerDeterminationService.test.ts`** - **9 failing tests** (unchanged)

## Specific Issues to Fix

### 🎯 Priority 1: Database Foundation (1 failure)
**File**: `tests/utils/db.test.ts`

**Issue**: Incomplete table truncation
```
expect(competitions?.length).toBe(0);
Expected: 0, Received: 1
```

**Root Cause**: The `truncateAllTables()` function isn't properly clearing the competitions table.

**Fix Needed**: 
1. Check the truncation order in `tests/utils/db.ts`
2. Ensure `competitions` table is being truncated
3. Verify CASCADE is working properly

**Debug Command**:
```bash
# Test just this one issue
npm test -- --testPathPattern="db.test" --testNamePattern="should result in empty tables after truncation" --maxWorkers=1 --verbose

# Check what's in the competitions table
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT * FROM competitions;"
```

### 🎯 Priority 2: Winner Determination Service (5 failures)
**File**: `src/services/winnerDeterminationService.test.ts`

**Issues Identified**:

1. **Auth User Creation Still Failing**:
   ```
   Failed to create test profiles: insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"
   ```
   **Despite claims this was fixed, it's still happening**

2. **Database Seeding Foreign Key Violations**:
   ```
   Failed to seed rounds: insert or update on table "rounds" violates foreign key constraint "rounds_season_id_fkey"
   ```

3. **Undefined Fixture Data**:
   ```
   TypeError: Cannot read properties of undefined (reading 'id')
   at Object.id (src/services/winnerDeterminationService.test.ts:191:61)
   ```

4. **Logic Issues**:
   ```
   expect(result.isSeasonAlreadyDetermined).toBe(true);
   Expected: true, Received: false
   ```

**Fixes Needed**:

#### Fix 1: Auth User Creation
```typescript
// In createTestProfiles() - ensure this pattern works:
console.log('[TEST_DB] Creating auth users...');
const authUsers = await Promise.all(
  testUsers.map(user => client.auth.admin.createUser({
    email: user.email, // Must be unique each time!
    email_confirm: true,
    user_metadata: { username: user.username }
  }))
);

// Check for failures
const failedUsers = authUsers.filter(result => result.error);
if (failedUsers.length > 0) {
  console.error('[TEST_DB] Auth user creation failed:', failedUsers);
  throw new Error('Auth user creation failed');
}
```

#### Fix 2: Seeding Order
```typescript
// In seedTestData() - ensure this order:
// 1. Competitions, teams (no dependencies)
// 2. Seasons (depends on competitions)  
// 3. Rounds (depends on seasons)
// 4. Fixtures (depends on rounds, teams)
// 5. Betting rounds, other dependent data
```

#### Fix 3: Null Checks
```typescript
// In tests - add null checks:
const { data: fixtures } = await client.from('fixtures').select('*');
if (!fixtures || fixtures.length === 0) {
  throw new Error('No fixtures found - seeding failed');
}
```

### 🎯 Priority 3: Cup Winner Determination Service (9 failures)
**File**: `src/services/cup/__tests__/cupWinnerDeterminationService.test.ts`

**Same core issues as Winner Determination Service**:
- `profiles_id_fkey` constraint violations  
- Multiple foreign key constraint violations during seeding
- Auth user creation failures

**Focus Areas**:
1. **Fix auth user creation pattern** (same as above)
2. **Fix seeding order for cup-specific tables**:
   - `user_last_round_special_points` table dependencies
   - `betting_round_fixtures` dependencies
3. **Verify cup-specific data setup**

## Systematic Fix Approach

### Step 1: Fix Database Foundation (Priority 1)
```bash
# Focus on the 1 remaining database test
supabase db reset
npm test -- --testPathPattern="db.test" --maxWorkers=1 --verbose

# Debug what's wrong with truncation
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT 
  'competitions' as table_name, COUNT(*) as count FROM competitions
UNION ALL  
SELECT 'seasons', COUNT(*) FROM seasons
UNION ALL
SELECT 'teams', COUNT(*) FROM teams;
"
```

### Step 2: Fix Auth User Creation Pattern
The `profiles_id_fkey` errors indicate the auth user creation fix didn't work properly.

**Debug Command**:
```bash
# Test just profile creation
npm test -- --testPathPattern="winnerDeterminationService" --testNamePattern="should return existing winners" --maxWorkers=1 --verbose

# Check auth users before and after test
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT id, email FROM auth.users;"
```

### Step 3: Fix Seeding Dependencies
Multiple foreign key violations suggest the seeding order is still wrong.

**Check Current Seeding Order**:
Look at `tests/utils/db.ts` in the `seedTestData()` function and verify:
1. Parent tables created before child tables
2. All foreign key references exist before insertion
3. Error handling shows which specific constraint failed

## Debugging Commands

### Check Database State
```bash
# See what's actually in the database after a failed test
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT 
  'auth_users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles  
UNION ALL
SELECT 'competitions', COUNT(*) FROM competitions
UNION ALL
SELECT 'seasons', COUNT(*) FROM seasons
UNION ALL
SELECT 'rounds', COUNT(*) FROM rounds
UNION ALL
SELECT 'fixtures', COUNT(*) FROM fixtures;
"
```

### Check Foreign Key Constraints
```bash
# See which foreign keys exist and might be violated
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('profiles', 'rounds', 'fixtures', 'betting_round_fixtures')
ORDER BY tc.table_name;
"
```

## Quick Wins to Try

### 1. Fix the Truncation Issue (Easiest)
The database test expecting 0 competitions but getting 1 is likely the easiest fix.

### 2. Add Better Error Logging
Add more detailed logging to `createTestProfiles()` to see exactly where auth user creation fails:

```typescript
console.log('[TEST_DB] Attempting to create auth users:', testUsers.map(u => u.email));
// ... auth creation code ...
console.log('[TEST_DB] Auth users created successfully:', actualUserIds);
```

### 3. Test Individual Components
```bash
# Test database utilities only
npm test -- --testPathPattern="db.test" --maxWorkers=1

# Test winner service only  
npm test -- --testPathPattern="winnerDeterminationService" --maxWorkers=1

# Test one specific failing test
npm test -- --testPathPattern="winnerDeterminationService" --testNamePattern="should return existing winners" --maxWorkers=1 --verbose
```

## Success Metrics

### Phase 1 Success:
- [ ] The 1 remaining database test passes (`truncateAllTables` works correctly)

### Phase 2 Success:  
- [ ] All 5 `winnerDeterminationService` tests pass
- [ ] No more `profiles_id_fkey` constraint violations
- [ ] No more `rounds_season_id_fkey` constraint violations

### Phase 3 Success:
- [ ] All 9 `cupWinnerDeterminationService` tests pass
- [ ] All foreign key constraint issues resolved

The debugging team has made **excellent progress** (22→15 failing tests), but the core **database state management issues** still need to be systematically addressed. 