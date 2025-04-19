import { SelectionsSchema, createSelectionsValidator } from '../bettingCouponSchema';
import type { Match } from '@/components/BettingCoupon/types';

describe('SelectionsSchema', () => {
  it('should validate valid selections', () => {
    const validSelections = {
      '1': '1' as const,
      '2': 'X' as const,
      '3': '2' as const,
      '4': null
    };

    const result = SelectionsSchema.safeParse(validSelections);
    expect(result.success).toBe(true);
  });

  it('should reject invalid selection values', () => {
    const invalidSelections = {
      '1': '1' as const,
      '2': 'invalid', // Invalid selection value
      '3': '2' as const
    };

    const result = SelectionsSchema.safeParse(invalidSelections);
    expect(result.success).toBe(false);
  });
});

describe('createSelectionsValidator', () => {
  const testMatches: Match[] = [
    { id: '1', homeTeam: 'Team A', awayTeam: 'Team B' },
    { id: '2', homeTeam: 'Team C', awayTeam: 'Team D' },
    { id: '3', homeTeam: 'Team E', awayTeam: 'Team F' }
  ];

  it('should validate when all matches have selections', () => {
    const validator = createSelectionsValidator(testMatches);
    
    const completeSelections = {
      '1': '1' as const,
      '2': 'X' as const,
      '3': '2' as const
    };
    
    const result = validator(completeSelections);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should invalidate when matches are missing selections', () => {
    const validator = createSelectionsValidator(testMatches);
    
    const incompleteSelections = {
      '1': '1' as const,
      // Match 2 missing
      '3': '2' as const
    };
    
    const result = validator(incompleteSelections);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('2', 'No selection made');
  });

  it('should invalidate when selections are null', () => {
    const validator = createSelectionsValidator(testMatches);
    
    const nullSelections = {
      '1': '1' as const,
      '2': null,
      '3': '2' as const
    };
    
    const result = validator(nullSelections);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('2', 'No selection made');
  });
}); 