import {
  ExactMatchStrategy,
  TopScorerStrategy,
  GoalDifferenceStrategy,
  ComparisonContext,
} from '../dynamicPointsCalculator';

// Mock logger to capture calls and verify enhanced logging
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

// Mock performance.now() for predictable timing tests
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
  writable: true,
});

describe('DynamicPointsCalculator - Enhanced Logging and Performance Monitoring', () => {
  
  beforeEach(() => {
    // Clear all spy calls before each test
    Object.values(loggerSpy).forEach(spy => spy.mockClear());
    mockPerformanceNow.mockClear();
  });

  const mockContext: ComparisonContext = {
    userId: 'test-user-123',
    questionType: 'test_question',
    competitionApiId: 39,
    seasonYear: 2023
  };

  describe('Performance Timing', () => {
    describe('ExactMatchStrategy Performance Logging', () => {
      let strategy: ExactMatchStrategy;

      beforeEach(() => {
        strategy = new ExactMatchStrategy();
      });

      it('should log performance timing information for comparisons', () => {
        // Mock performance timing (fast comparison should use debug level)
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // Start time
          .mockReturnValueOnce(100.5); // End time (0.5ms elapsed - fast)

        const result = strategy.compare(123, [123, 456], mockContext);

        expect(result.isMatch).toBe(true);
        
        // Should log with performance data (debug level for fast comparisons)
        expect(loggerSpy.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            performance: expect.objectContaining({
              comparisonTimeMs: 0.5,
              validAnswersProcessed: 2
            })
          }),
          expect.stringContaining('(0.500ms)')
        );
      });

      it('should use info level for slow comparisons (>1ms)', () => {
        // Mock slow comparison
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // Start time
          .mockReturnValueOnce(101.5); // End time (1.5ms elapsed - above threshold)

        strategy.compare(123, [123], mockContext);
        
        // Should use info level for slow comparisons
        expect(loggerSpy.info).toHaveBeenCalled();
        expect(loggerSpy.debug).not.toHaveBeenCalled();
      });

      it('should use info level for large valid answer arrays (>10)', () => {
        // Mock fast comparison but large array
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // Start time
          .mockReturnValueOnce(100.3); // End time (0.3ms elapsed - fast)

        const largeValidAnswers = Array.from({length: 12}, (_, i) => i + 1); // 12 answers
        strategy.compare(5, largeValidAnswers, mockContext);
        
        // Should use info level for large arrays even if fast
        expect(loggerSpy.info).toHaveBeenCalled();
        expect(loggerSpy.debug).not.toHaveBeenCalled();
      });

      it('should use debug level for fast, small comparisons', () => {
        // Mock fast comparison with small array
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // Start time
          .mockReturnValueOnce(100.2); // End time (0.2ms elapsed - fast)

        strategy.compare(123, [123, 456], mockContext);
        
        // Should use debug level for normal scenarios
        expect(loggerSpy.debug).toHaveBeenCalled();
        expect(loggerSpy.info).not.toHaveBeenCalled();
      });
    });

    describe('TopScorerStrategy Performance Logging', () => {
      let strategy: TopScorerStrategy;

      beforeEach(() => {
        strategy = new TopScorerStrategy();
      });

      it('should log tie processing time for multiple tied players', () => {
        const tiedPlayers = [100, 200, 300]; // 3-way tie
        
        // Mock performance timing for TopScorerStrategy  
        // Order: TopScorer start, ExactMatch start, ExactMatch end, TopScorer end
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // TopScorer start
          .mockReturnValueOnce(100.1) // ExactMatch start (inside super.compare())
          .mockReturnValueOnce(100.2) // ExactMatch end (inside super.compare())
          .mockReturnValueOnce(101.5); // TopScorer end (1.5ms total processing)

        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };

        strategy.compare(200, tiedPlayers, context);

        // Verify that a tie was detected and logged (could be debug or info level)
        const allCalls = [...loggerSpy.debug.mock.calls, ...loggerSpy.info.mock.calls];
        const tieCall = allCalls.find(call => 
          call[1] && call[1].includes('Top scorer tie detected')
        );
        
        expect(tieCall).toBeDefined();
        expect(tieCall[0]).toEqual(
          expect.objectContaining({
            tiedPlayers: 3,
            tiedPlayerIds: tiedPlayers,
            performance: expect.objectContaining({
              tieProcessingTimeMs: 1.5,
              playersEvaluated: 3
            })
          })
        );
        expect(tieCall[1]).toContain('(1.500ms processing)');
      });

      it('should use info level for complex ties (>5 players)', () => {
        const complexTie = [100, 200, 300, 400, 500, 600]; // 6-way tie
        
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // ExactMatch start
          .mockReturnValueOnce(100.1) // ExactMatch end
          .mockReturnValueOnce(100.0) // TopScorer start
          .mockReturnValueOnce(101.0); // TopScorer end (1.0ms)

        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };

        strategy.compare(300, complexTie, context);

        // Should use info level for complex ties
        expect(loggerSpy.info).toHaveBeenCalledWith(
          expect.objectContaining({
            tiedPlayers: 6,
            performance: expect.objectContaining({
              playersEvaluated: 6
            })
          }),
          expect.stringContaining('Top scorer tie detected')
        );
      });

      it('should use info level for slow tie processing (>2ms)', () => {
        const tiedPlayers = [100, 200]; // Simple 2-way tie
        
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // ExactMatch start
          .mockReturnValueOnce(100.1) // ExactMatch end
          .mockReturnValueOnce(100.0) // TopScorer start
          .mockReturnValueOnce(102.5); // TopScorer end (2.5ms - slow)

        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };

        strategy.compare(100, tiedPlayers, context);

        // Should use info level for slow processing
        expect(loggerSpy.info).toHaveBeenCalledWith(
          expect.objectContaining({
            performance: expect.objectContaining({
              tieProcessingTimeMs: 2.5
            })
          }),
          expect.stringContaining('(2.500ms processing)')
        );
      });

      it('should not log tie detection for single player scenarios', () => {
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // ExactMatch start
          .mockReturnValueOnce(100.1); // ExactMatch end

        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'top_scorer'
        };

        strategy.compare(100, [100], context); // Single player, no tie

        // Should not log tie detection
        expect(loggerSpy.debug).not.toHaveBeenCalledWith(
          expect.objectContaining({
            tiedPlayers: expect.any(Number)
          }),
          expect.stringContaining('Top scorer tie detected')
        );

        expect(loggerSpy.info).not.toHaveBeenCalledWith(
          expect.objectContaining({
            tiedPlayers: expect.any(Number)
          }),
          expect.stringContaining('Top scorer tie detected')
        );
      });
    });

    describe('GoalDifferenceStrategy Performance Logging', () => {
      let strategy: GoalDifferenceStrategy;

      beforeEach(() => {
        strategy = new GoalDifferenceStrategy();
      });

      it('should log tie processing time for multiple tied teams', () => {
        const tiedTeams = [1, 2, 3, 4]; // 4-way tie
        
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // ExactMatch start
          .mockReturnValueOnce(100.2) // ExactMatch end
          .mockReturnValueOnce(100.0) // GoalDifference start
          .mockReturnValueOnce(101.8); // GoalDifference end (1.8ms)

        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'best_goal_difference'
        };

        strategy.compare(2, tiedTeams, context);

        expect(loggerSpy.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            tiedTeams: 4,
            tiedTeamIds: tiedTeams,
            performance: expect.objectContaining({
              tieProcessingTimeMs: 1.8,
              teamsEvaluated: 4
            })
          }),
          expect.stringContaining('Goal difference tie detected')
        );
      });

      it('should use info level for large ties (>8 teams)', () => {
        const largeTie = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // 9-way tie
        
        mockPerformanceNow
          .mockReturnValueOnce(100.0) // ExactMatch start
          .mockReturnValueOnce(100.1) // ExactMatch end
          .mockReturnValueOnce(100.0) // GoalDifference start
          .mockReturnValueOnce(101.5); // GoalDifference end

        const context: ComparisonContext = {
          ...mockContext,
          questionType: 'best_goal_difference'
        };

        strategy.compare(5, largeTie, context);

        // Should use info level for large ties
        expect(loggerSpy.info).toHaveBeenCalledWith(
          expect.objectContaining({
            tiedTeams: 9,
            performance: expect.objectContaining({
              teamsEvaluated: 9
            })
          }),
          expect.stringContaining('Goal difference tie detected')
        );
      });
    });
  });

  describe('Log Level Controls', () => {
    it('should provide appropriate log level controls for different verbosity needs', () => {
      const strategy = new ExactMatchStrategy();
      
      // Test scenario that should use debug level (normal operation)
      mockPerformanceNow
        .mockReturnValueOnce(100.0)
        .mockReturnValueOnce(100.1); // 0.1ms - fast

      strategy.compare(123, [123], mockContext);

      expect(loggerSpy.debug).toHaveBeenCalled();
      expect(loggerSpy.info).not.toHaveBeenCalled();
      
      // Clear calls
      Object.values(loggerSpy).forEach(spy => spy.mockClear());
      
      // Test scenario that should use info level (performance monitoring)
      mockPerformanceNow
        .mockReturnValueOnce(200.0)
        .mockReturnValueOnce(202.0); // 2.0ms - slow

      strategy.compare(456, [456], mockContext);

      expect(loggerSpy.info).toHaveBeenCalled();
      expect(loggerSpy.debug).not.toHaveBeenCalled();
    });
  });

  describe('Enhanced Logging Content', () => {
    it('should include comprehensive performance metrics in log data', () => {
      const strategy = new ExactMatchStrategy();
      
      mockPerformanceNow
        .mockReturnValueOnce(100.0)
        .mockReturnValueOnce(103.2); // 3.2ms

      strategy.compare(123, [123, 456, 789], mockContext);

      expect(loggerSpy.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-123',
          questionType: 'test_question',
          userPrediction: 123,
          validAnswers: [123, 456, 789],
          totalValidAnswers: 3,
          isMatch: true,
          matchedAnswer: 123,
          strategy: 'ExactMatch',
          performance: {
            comparisonTimeMs: 3.2,
            validAnswersProcessed: 3
          }
        }),
        expect.stringContaining('(3.200ms)')
      );
    });

    it('should format timing information consistently', () => {
      const strategy = new TopScorerStrategy();
      
      mockPerformanceNow
        .mockReturnValueOnce(100.0) // ExactMatch start
        .mockReturnValueOnce(100.123) // ExactMatch end
        .mockReturnValueOnce(100.0) // TopScorer start  
        .mockReturnValueOnce(100.567); // TopScorer end

      const context: ComparisonContext = {
        ...mockContext,
        questionType: 'top_scorer'
      };

      strategy.compare(100, [100, 200], context);

      // Should format timing to 3 decimal places consistently
      expect(loggerSpy.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          performance: expect.objectContaining({
            tieProcessingTimeMs: 0.567
          })
        }),
        expect.stringContaining('(0.567ms processing)')
      );
    });
  });
}); 