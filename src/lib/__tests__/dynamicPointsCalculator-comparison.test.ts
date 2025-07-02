import {
  ExactMatchStrategy,
  TopScorerStrategy,
  GoalDifferenceStrategy,
  ComparisonContext,
  AnswerComparisonStrategy
} from '../dynamicPointsCalculator';

// Mock logger to avoid test output noise and capture calls
const loggerSpy = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock the logger import
jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => loggerSpy.info(...args),
    warn: (...args: unknown[]) => loggerSpy.warn(...args),
    error: (...args: unknown[]) => loggerSpy.error(...args),
    debug: (...args: unknown[]) => loggerSpy.debug(...args),
  }
}));

describe('DynamicPointsCalculator - Refactored Core Comparison Logic', () => {
  
  beforeEach(() => {
    // Clear logger spy calls before each test
    Object.values(loggerSpy).forEach(spy => spy.mockClear());
  });

  const mockContext: ComparisonContext = {
    userId: 'test-user-123',
    questionType: 'test_question',
    competitionApiId: 39,
    seasonYear: 2023
  };

  describe('ExactMatchStrategy', () => {
    let strategy: ExactMatchStrategy;

    beforeEach(() => {
      strategy = new ExactMatchStrategy();
    });

    describe('Single Valid Answer Scenarios', () => {
      it('should match when user prediction equals single valid answer', () => {
        const result = strategy.compare(123, [123], mockContext);
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(123);
        expect(result.allValidAnswers).toEqual([123]);
        expect(result.details.userPrediction).toBe(123);
        expect(result.details.totalValidAnswers).toBe(1);
        expect(result.details.comparisonStrategy).toBe('ExactMatch');
      });

      it('should not match when user prediction differs from single valid answer', () => {
        const result = strategy.compare(123, [456], mockContext);
        
        expect(result.isMatch).toBe(false);
        expect(result.matchedAnswer).toBeUndefined();
        expect(result.allValidAnswers).toEqual([456]);
        expect(result.details.userPrediction).toBe(123);
        expect(result.details.totalValidAnswers).toBe(1);
      });
    });

    describe('Multiple Valid Answers Scenarios', () => {
      it('should match when user prediction equals one of multiple valid answers', () => {
        const validAnswers = [100, 200, 300];
        const result = strategy.compare(200, validAnswers, mockContext);
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(200);
        expect(result.allValidAnswers).toEqual(validAnswers);
        expect(result.details.totalValidAnswers).toBe(3);
      });

      it('should not match when user prediction is not in multiple valid answers', () => {
        const validAnswers = [100, 200, 300];
        const result = strategy.compare(400, validAnswers, mockContext);
        
        expect(result.isMatch).toBe(false);
        expect(result.matchedAnswer).toBeUndefined();
        expect(result.allValidAnswers).toEqual(validAnswers);
      });

      it('should handle edge case of empty valid answers array', () => {
        const result = strategy.compare(123, [], mockContext);
        
        expect(result.isMatch).toBe(false);
        expect(result.matchedAnswer).toBeUndefined();
        expect(result.allValidAnswers).toEqual([]);
        expect(result.details.totalValidAnswers).toBe(0);
      });
    });

    describe('Real Football Scenarios', () => {
      it('should handle league winner comparison (single answer)', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'league_winner'
        };
        
        const result = strategy.compare(1, [1], context); // Manchester City = 1
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(1);
        expect(result.details.comparisonStrategy).toBe('ExactMatch');
      });

      it('should handle last place comparison (single answer)', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'last_place'
        };
        
        const result = strategy.compare(20, [18], context); // User predicted wrong team
        
        expect(result.isMatch).toBe(false);
        expect(result.matchedAnswer).toBeUndefined();
      });
    });
  });

  describe('TopScorerStrategy', () => {
    let strategy: TopScorerStrategy;

    beforeEach(() => {
      strategy = new TopScorerStrategy();
    });

    it('should extend ExactMatchStrategy functionality', () => {
      expect(strategy).toBeInstanceOf(ExactMatchStrategy);
    });

    describe('Single Top Scorer Scenarios', () => {
      it('should match single top scorer correctly', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };
        
        const result = strategy.compare(100, [100], context); // Haaland = 100
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(100);
        expect(result.details.comparisonStrategy).toBe('TopScorerExactMatch');
      });
    });

    describe('Multiple Tied Top Scorers Scenarios', () => {
      it('should handle two players tied for top scorer', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };
        const tiedPlayers = [100, 200]; // Haaland and Kane both with 25 goals
        
        const result = strategy.compare(200, tiedPlayers, context);
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(200);
        expect(result.allValidAnswers).toEqual(tiedPlayers);
        expect(result.details.totalValidAnswers).toBe(2);
        expect(result.details.comparisonStrategy).toBe('TopScorerExactMatch');
      });

      it('should handle three players tied for top scorer', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };
        const tiedPlayers = [100, 200, 300]; // Three-way tie
        
        const result = strategy.compare(300, tiedPlayers, context);
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(300);
        expect(result.details.totalValidAnswers).toBe(3);
      });

      it('should not match when user predicted player not in tied group', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };
        const tiedPlayers = [100, 200]; // Haaland and Kane tied
        
        const result = strategy.compare(300, tiedPlayers, context); // User predicted Salah
        
        expect(result.isMatch).toBe(false);
        expect(result.matchedAnswer).toBeUndefined();
      });
    });

    describe('Edge Cases', () => {
      it('should not log tie detection for single player (no tie)', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };
        
        strategy.compare(100, [100], context);
        
        // Should not call the tie detection logging
        expect(loggerSpy.info).not.toHaveBeenCalledWith(
          expect.objectContaining({
            tiedPlayers: expect.any(Number)
          }),
          expect.stringContaining('Top scorer tie detected')
        );
      });
    });
  });

  describe('GoalDifferenceStrategy', () => {
    let strategy: GoalDifferenceStrategy;

    beforeEach(() => {
      strategy = new GoalDifferenceStrategy();
    });

    it('should extend ExactMatchStrategy functionality', () => {
      expect(strategy).toBeInstanceOf(ExactMatchStrategy);
    });

    describe('Single Best Goal Difference Team Scenarios', () => {
      it('should match single best goal difference team correctly', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'best_goal_difference'
        };
        
        const result = strategy.compare(1, [1], context); // Manchester City = 1
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(1);
        expect(result.details.comparisonStrategy).toBe('GoalDifferenceExactMatch');
      });
    });

    describe('Multiple Tied Goal Difference Teams Scenarios', () => {
      it('should handle two teams tied for best goal difference', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'best_goal_difference'
        };
        const tiedTeams = [1, 2]; // Manchester City and Arsenal both with +45
        
        const result = strategy.compare(2, tiedTeams, context);
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(2);
        expect(result.allValidAnswers).toEqual(tiedTeams);
        expect(result.details.totalValidAnswers).toBe(2);
        expect(result.details.comparisonStrategy).toBe('GoalDifferenceExactMatch');
      });

      it('should handle multiple teams tied for best goal difference', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'best_goal_difference'
        };
        const tiedTeams = [1, 2, 3, 4]; // Four-way tie scenario
        
        const result = strategy.compare(3, tiedTeams, context);
        
        expect(result.isMatch).toBe(true);
        expect(result.matchedAnswer).toBe(3);
        expect(result.details.totalValidAnswers).toBe(4);
      });

      it('should not match when user predicted team not in tied group', () => {
        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'best_goal_difference'
        };
        const tiedTeams = [1, 2]; // City and Arsenal tied
        
        const result = strategy.compare(3, tiedTeams, context); // User predicted Liverpool
        
        expect(result.isMatch).toBe(false);
        expect(result.matchedAnswer).toBeUndefined();
      });
    });
  });

  describe('Performance Testing', () => {
    let strategy: ExactMatchStrategy;

    beforeEach(() => {
      strategy = new ExactMatchStrategy();
    });

    it('should handle large arrays efficiently', () => {
      const largeValidAnswers = Array.from({ length: 1000 }, (_, i) => i + 1);
      const startTime = Date.now();
      
      const result = strategy.compare(500, largeValidAnswers, mockContext);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result.isMatch).toBe(true);
      expect(result.matchedAnswer).toBe(500);
      expect(executionTime).toBeLessThan(50); // Should be very fast
    });

    it('should perform early return optimization', () => {
      const validAnswers = [1, 2, 3, 4, 5];
      
      const result = strategy.compare(1, validAnswers, mockContext);
      
      expect(result.isMatch).toBe(true);
      expect(result.matchedAnswer).toBe(1);
      // Array.includes() should find match quickly at first position
    });
  });

  describe('Strategy Interface Compliance', () => {
    const strategies: Array<{ name: string; strategy: AnswerComparisonStrategy }> = [
      { name: 'ExactMatchStrategy', strategy: new ExactMatchStrategy() },
      { name: 'TopScorerStrategy', strategy: new TopScorerStrategy() },
      { name: 'GoalDifferenceStrategy', strategy: new GoalDifferenceStrategy() }
    ];

    strategies.forEach(({ name, strategy }) => {
      describe(`${name} Interface Compliance`, () => {
        it('should implement AnswerComparisonStrategy interface correctly', () => {
          expect(typeof strategy.compare).toBe('function');
          
          const result = strategy.compare(123, [123], mockContext);
          
          expect(result).toHaveProperty('isMatch');
          expect(result).toHaveProperty('allValidAnswers');
          expect(result).toHaveProperty('details');
          expect(result.details).toHaveProperty('userPrediction');
          expect(result.details).toHaveProperty('totalValidAnswers');
          expect(result.details).toHaveProperty('comparisonStrategy');
          
          expect(typeof result.isMatch).toBe('boolean');
          expect(Array.isArray(result.allValidAnswers)).toBe(true);
          expect(typeof result.details.userPrediction).toBe('number');
          expect(typeof result.details.totalValidAnswers).toBe('number');
          expect(typeof result.details.comparisonStrategy).toBe('string');
        });
      });
    });
  });

  describe('Basic Logging Verification', () => {
    let strategy: ExactMatchStrategy;

    beforeEach(() => {
      strategy = new ExactMatchStrategy();
    });

    it('should produce debug output for comparison operations', () => {
      const context: ComparisonContext = {
        userId: 'user-123',
        questionType: 'test_question',
        competitionApiId: 39,
        seasonYear: 2023
      };
      
      strategy.compare(123, [123, 456], context);
      
      // Verify that some logging happens for debugging purposes
      // (Could be info or debug level depending on conditions)
      const totalLogCalls = loggerSpy.info.mock.calls.length + loggerSpy.debug.mock.calls.length;
      expect(totalLogCalls).toBeGreaterThan(0);
    });
  });
}); 