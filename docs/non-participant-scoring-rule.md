# Non-Participant Scoring Rule

## Overview

The non-participant scoring rule ensures that users who miss submitting their bets for a betting round are not unfairly penalized. Instead of receiving 0 points, they receive the same number of points as the lowest-scoring participant who did submit bets for that round.

## Purpose

This rule serves to:
- **Keep the competition fun and fair** - prevents users from falling too far behind due to life circumstances
- **Encourage continued participation** - users won't be discouraged by one or two missed rounds
- **Maintain competitive balance** - ensures missing a round doesn't create an insurmountable disadvantage

## How It Works

### Basic Logic

1. **Identify Participants**: Find all users who submitted at least one bet for the betting round
2. **Calculate Minimum Score**: Among all participants, find the lowest total score for that round
3. **Identify Non-Participants**: Find all users who submitted zero bets for the round
4. **Award Points**: Give each non-participant the same number of points as the minimum participant score

### Example Scenarios

#### Scenario 1: Normal Round
- **Round**: Premier League Round 5 (5 matches)
- **Participants**: 
  - Alice: 3 correct predictions = 3 points
  - Bob: 0 correct predictions = 0 points  
  - Charlie: 2 correct predictions = 2 points
- **Non-Participants**: Dave, Emma
- **Result**: Dave and Emma each receive 0 points (Bob's minimum score)

#### Scenario 2: Everyone Scores
- **Round**: Premier League Round 6 (5 matches)
- **Participants**:
  - Alice: 4 correct predictions = 4 points
  - Bob: 1 correct prediction = 1 point
  - Charlie: 3 correct predictions = 3 points
- **Non-Participants**: Dave, Emma
- **Result**: Dave and Emma each receive 1 point (Bob's minimum score)

#### Scenario 3: No Participants
- **Round**: Premier League Round 7 (5 matches)
- **Participants**: None (everyone forgot to submit)
- **Non-Participants**: Alice, Bob, Charlie, Dave, Emma
- **Result**: Everyone receives 0 points (no one gets an advantage)

## Implementation Details

### When It Applies

- ✅ **User submitted zero bets** for the entire betting round
- ✅ **Round has been scored** (all matches finished and points calculated)
- ✅ **At least one other user participated** in the round

### When It Doesn't Apply

- ❌ **User submitted partial bets** (impossible in current system - must submit full coupon)
- ❌ **Round hasn't been scored yet** (matches still ongoing)
- ❌ **Applied retroactively** to already-completed rounds

### Technical Implementation

The rule is implemented in the `applyNonParticipantScoringRule()` function within the scoring system (`src/lib/scoring.ts`). It runs automatically after regular match scoring completes.

#### Process Flow

1. **Regular Scoring**: Calculate points for all submitted bets
2. **Dynamic Points**: Process questionnaire-based dynamic points
3. **Non-Participant Rule**: Apply the non-participant scoring rule ⭐ **NEW**
4. **Completion**: Mark round as fully scored

#### Database Changes

For non-participants, the system creates "virtual" bet records with:
- **Prediction**: Dummy value (doesn't affect scoring since points are pre-calculated)
- **Points**: Distributed across fixtures to sum to the minimum participant score
- **Timestamps**: Current timestamp when rule is applied

### Point Distribution Logic

Since each individual bet can only award 0 or 1 point maximum, points are distributed as follows:

- **If minimum score = 2 and round has 5 fixtures**:
  - Fixture 1: 1 point
  - Fixture 2: 1 point  
  - Fixtures 3-5: 0 points each
  - **Total**: 2 points

- **If minimum score = 0**:
  - All fixtures: 0 points each
  - **Total**: 0 points

## Edge Cases

### All Users Participated
- **Behavior**: Rule skips processing, no changes made
- **Log Message**: "All users participated - no non-participant scoring needed"

### No Users Participated  
- **Behavior**: Rule skips processing, everyone has 0 points
- **Log Message**: "No participants found - no non-participant scoring needed"

### Error Handling
- **Database Errors**: Rule fails gracefully, doesn't affect main scoring
- **Logging**: All operations are logged for debugging and transparency
- **Idempotency**: Safe to run multiple times on the same round

## Configuration

### Environment Variables

No special configuration is required. The rule uses the same database connection and logging as the main scoring system.

### Enabling/Disabling

The rule is automatically enabled for all future rounds. To disable:

1. Comment out the non-participant rule section in `calculateAndStoreMatchPoints()`
2. Or modify the `applyNonParticipantScoringRule()` function to return early

## Monitoring & Debugging

### Log Messages

The system logs detailed information about non-participant scoring:

```
INFO: Applying non-participant scoring rule...
INFO: Found minimum participant score: 2, participantCount: 3
INFO: Non-participant scoring completed: 2 users given 2 points
```

### Metrics Available

- `nonParticipantsProcessed`: Number of users who received points
- `minimumParticipantScore`: The score awarded to non-participants  
- `participantCount`: Number of users who submitted bets
- `nonParticipantCount`: Number of users who didn't submit bets

### Database Verification

To verify the rule worked correctly, check:

```sql
-- Count bets per user for a round
SELECT user_id, COUNT(*) as bet_count, SUM(points_awarded) as total_points
FROM user_bets 
WHERE betting_round_id = [ROUND_ID]
GROUP BY user_id
ORDER BY total_points;
```

## Testing

The non-participant scoring rule has comprehensive test coverage including:

- ✅ Normal operation with mixed participant/non-participant users
- ✅ Edge case: No participants  
- ✅ Edge case: All users participated
- ✅ Point distribution across multiple fixtures
- ✅ Database error handling
- ✅ Integration with main scoring system

Run tests with:
```bash
npm test -- src/lib/scoring.test.ts
```

## Future Considerations

### Potential Enhancements

1. **Configurable Rule**: Allow toggling the rule on/off per competition
2. **Alternative Scoring**: Instead of minimum, use median or custom formula
3. **Partial Credit**: Different logic for users who submit some but not all bets
4. **Historical Application**: Option to apply rule retroactively (with admin approval)

### Database Performance

For leagues with many users, consider:
- Indexing on `user_bets.betting_round_id` and `user_bets.user_id`
- Batch processing for large user counts
- Caching minimum scores to avoid recalculation

---

*This rule was implemented in version 1.0 and applies to all betting rounds scored after deployment.* 