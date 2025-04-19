import { SelectionsSchema, createSelectionsValidator, validateCoupon } from '../bettingCouponSchema';
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
    expect(result.errors).toHaveProperty('2');
    expect(result.errors?.['2']).toContain('Team C vs Team D'); // Check for descriptive error
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
    expect(result.errors).toHaveProperty('2');
    expect(result.errors?.['2']).toContain('Team C vs Team D'); // Check for descriptive error
  });
});

describe('validateCoupon', () => {
  const testMatches: Match[] = [
    { id: '1', homeTeam: 'Team A', awayTeam: 'Team B' },
    { id: '2', homeTeam: 'Team C', awayTeam: 'Team D' },
    { id: '3', homeTeam: 'Team E', awayTeam: 'Team F' }
  ];

  it('should validate when all matches have valid selections', () => {
    const completeSelections = {
      '1': '1' as const,
      '2': 'X' as const,
      '3': '2' as const
    };
    
    const result = validateCoupon(testMatches, completeSelections);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should invalidate when selections have invalid structure', () => {
    const invalidSelections = {
      '1': '1' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      '2': 'invalid' as any, // Invalid selection
      '3': '2' as const
    };
    
    const result = validateCoupon(testMatches, invalidSelections);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('2');
    expect(result.errors?.['2']).toContain('Invalid selection');
  });

  it('should invalidate when matches are missing selections', () => {
    const incompleteSelections = {
      '1': '1' as const,
      // Match 2 missing
      '3': '2' as const
    };
    
    const result = validateCoupon(testMatches, incompleteSelections);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('2');
    expect(result.errors?.['2']).toContain('Team C vs Team D');
  });

  it('should handle selections with extra matches not in the match list', () => {
    const extraSelections = {
      '1': '1' as const,
      '2': 'X' as const,
      '3': '2' as const,
      '4': '1' as const, // Extra match not in testMatches
    };
    
    const result = validateCoupon(testMatches, extraSelections);
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeUndefined();
  });
}); 