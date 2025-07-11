import { activationConditionCalculator, ACTIVATION_THRESHOLD } from '../activationConditionCalculator';
import { FixtureDataResult, TeamRemainingGames } from '../fixtureDataService';
import { logger } from '@/utils/logger';

// Mock dependencies
jest.mock('@/utils/logger');

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ActivationConditionCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger.error = jest.fn();
  });

  describe('calculateActivationCondition', () => {
    it('should return conditionMet=true when exactly 60% of teams have ≤5 games', async () => {
      // 10 teams, 6 with ≤5 games (60%)
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 3 },
          { teamId: 2, teamName: 'Team2', remainingGames: 5 },
          { teamId: 3, teamName: 'Team3', remainingGames: 2 },
          { teamId: 4, teamName: 'Team4', remainingGames: 4 },
          { teamId: 5, teamName: 'Team5', remainingGames: 1 },
          { teamId: 6, teamName: 'Team6', remainingGames: 5 },
          { teamId: 7, teamName: 'Team7', remainingGames: 6 },
          { teamId: 8, teamName: 'Team8', remainingGames: 7 },
          { teamId: 9, teamName: 'Team9', remainingGames: 8 },
          { teamId: 10, teamName: 'Team10', remainingGames: 9 }
        ],
        totalTeams: 10,
        teamsWithFiveOrFewerGames: 6,
        percentageWithFiveOrFewerGames: 60
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData);

      expect(result.conditionMet).toBe(true);
      expect(result.totalTeams).toBe(10);
      expect(result.teamsWithFiveOrFewerGames).toBe(6);
      expect(result.percentageWithFiveOrFewerGames).toBe(60);
      expect(result.threshold).toBe(60);
      expect(result.reasoning).toContain('meets the 60% threshold');
    });

    it('should return conditionMet=false when only 50% of teams have ≤5 games', async () => {
      // 10 teams, 5 with ≤5 games (50%)
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 3 },
          { teamId: 2, teamName: 'Team2', remainingGames: 5 },
          { teamId: 3, teamName: 'Team3', remainingGames: 2 },
          { teamId: 4, teamName: 'Team4', remainingGames: 4 },
          { teamId: 5, teamName: 'Team5', remainingGames: 1 },
          { teamId: 6, teamName: 'Team6', remainingGames: 6 },
          { teamId: 7, teamName: 'Team7', remainingGames: 7 },
          { teamId: 8, teamName: 'Team8', remainingGames: 8 },
          { teamId: 9, teamName: 'Team9', remainingGames: 9 },
          { teamId: 10, teamName: 'Team10', remainingGames: 10 }
        ],
        totalTeams: 10,
        teamsWithFiveOrFewerGames: 5,
        percentageWithFiveOrFewerGames: 50
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData);

      expect(result.conditionMet).toBe(false);
      expect(result.totalTeams).toBe(10);
      expect(result.teamsWithFiveOrFewerGames).toBe(5);
      expect(result.percentageWithFiveOrFewerGames).toBe(50);
      expect(result.threshold).toBe(60);
      expect(result.reasoning).toContain('does not meet the 60% threshold');
    });

    it('should return conditionMet=true when 70% of teams have ≤5 games', async () => {
      // 10 teams, 7 with ≤5 games (70%)
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 3 },
          { teamId: 2, teamName: 'Team2', remainingGames: 5 },
          { teamId: 3, teamName: 'Team3', remainingGames: 2 },
          { teamId: 4, teamName: 'Team4', remainingGames: 4 },
          { teamId: 5, teamName: 'Team5', remainingGames: 1 },
          { teamId: 6, teamName: 'Team6', remainingGames: 0 },
          { teamId: 7, teamName: 'Team7', remainingGames: 5 },
          { teamId: 8, teamName: 'Team8', remainingGames: 6 },
          { teamId: 9, teamName: 'Team9', remainingGames: 7 },
          { teamId: 10, teamName: 'Team10', remainingGames: 8 }
        ],
        totalTeams: 10,
        teamsWithFiveOrFewerGames: 7,
        percentageWithFiveOrFewerGames: 70
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData);

      expect(result.conditionMet).toBe(true);
      expect(result.totalTeams).toBe(10);
      expect(result.teamsWithFiveOrFewerGames).toBe(7);
      expect(result.percentageWithFiveOrFewerGames).toBe(70);
      expect(result.threshold).toBe(60);
      expect(result.reasoning).toContain('meets the 60% threshold');
    });

    it('should return conditionMet=true when all teams have ≤5 games', async () => {
      // 5 teams, all with ≤5 games (100%)
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 3 },
          { teamId: 2, teamName: 'Team2', remainingGames: 5 },
          { teamId: 3, teamName: 'Team3', remainingGames: 2 },
          { teamId: 4, teamName: 'Team4', remainingGames: 4 },
          { teamId: 5, teamName: 'Team5', remainingGames: 1 }
        ],
        totalTeams: 5,
        teamsWithFiveOrFewerGames: 5,
        percentageWithFiveOrFewerGames: 100
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData);

      expect(result.conditionMet).toBe(true);
      expect(result.totalTeams).toBe(5);
      expect(result.teamsWithFiveOrFewerGames).toBe(5);
      expect(result.percentageWithFiveOrFewerGames).toBe(100);
      expect(result.threshold).toBe(60);
      expect(result.reasoning).toContain('meets the 60% threshold');
    });

    it('should return conditionMet=false when no teams have ≤5 games', async () => {
      // 5 teams, none with ≤5 games (0%)
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 6 },
          { teamId: 2, teamName: 'Team2', remainingGames: 7 },
          { teamId: 3, teamName: 'Team3', remainingGames: 8 },
          { teamId: 4, teamName: 'Team4', remainingGames: 9 },
          { teamId: 5, teamName: 'Team5', remainingGames: 10 }
        ],
        totalTeams: 5,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData);

      expect(result.conditionMet).toBe(false);
      expect(result.totalTeams).toBe(5);
      expect(result.teamsWithFiveOrFewerGames).toBe(0);
      expect(result.percentageWithFiveOrFewerGames).toBe(0);
      expect(result.threshold).toBe(60);
      expect(result.reasoning).toContain('does not meet the 60% threshold');
    });

    it('should work with custom threshold values', async () => {
      // Test with 50% threshold
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 3 },
          { teamId: 2, teamName: 'Team2', remainingGames: 7 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData, 50);

      expect(result.conditionMet).toBe(true);
      expect(result.threshold).toBe(50);
      expect(result.reasoning).toContain('meets the 50% threshold');
    });

    it('should handle edge case with exactly 0 teams', async () => {
      const fixtureData: FixtureDataResult = {
        teams: [],
        totalTeams: 0,
        teamsWithFiveOrFewerGames: 0,
        percentageWithFiveOrFewerGames: 0
      };

      const result = await activationConditionCalculator.calculateActivationCondition(fixtureData);

      expect(result.conditionMet).toBe(false);
      expect(result.totalTeams).toBe(0);
      expect(result.teamsWithFiveOrFewerGames).toBe(0);
      expect(result.percentageWithFiveOrFewerGames).toBe(0);
    });

    it('should throw error for invalid threshold values', async () => {
      const fixtureData: FixtureDataResult = {
        teams: [{ teamId: 1, teamName: 'Team1', remainingGames: 3 }],
        totalTeams: 1,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 100
      };

      await expect(activationConditionCalculator.calculateActivationCondition(fixtureData, -1))
        .rejects.toThrow('Threshold must be between 0 and 100');

      await expect(activationConditionCalculator.calculateActivationCondition(fixtureData, 101))
        .rejects.toThrow('Threshold must be between 0 and 100');
    });

    it('should throw error for null/undefined fixture data', async () => {
      await expect(activationConditionCalculator.calculateActivationCondition(null as any))
        .rejects.toThrow('Fixture data is required');

      await expect(activationConditionCalculator.calculateActivationCondition(undefined as any))
        .rejects.toThrow('Fixture data is required');
    });
  });

  describe('calculateActivationConditionFromTeams', () => {
    it('should correctly calculate from raw teams data', async () => {
      const teams: TeamRemainingGames[] = [
        { teamId: 1, teamName: 'Team1', remainingGames: 3 },
        { teamId: 2, teamName: 'Team2', remainingGames: 5 },
        { teamId: 3, teamName: 'Team3', remainingGames: 6 },
        { teamId: 4, teamName: 'Team4', remainingGames: 7 },
        { teamId: 5, teamName: 'Team5', remainingGames: 2 }
      ];

      const result = await activationConditionCalculator.calculateActivationConditionFromTeams(teams);

      expect(result.conditionMet).toBe(true); // 3 out of 5 teams have ≤5 games (60%)
      expect(result.totalTeams).toBe(5);
      expect(result.teamsWithFiveOrFewerGames).toBe(3);
      expect(result.percentageWithFiveOrFewerGames).toBe(60);
    });

    it('should handle empty teams array', async () => {
      const teams: TeamRemainingGames[] = [];

      const result = await activationConditionCalculator.calculateActivationConditionFromTeams(teams);

      expect(result.conditionMet).toBe(false);
      expect(result.totalTeams).toBe(0);
      expect(result.teamsWithFiveOrFewerGames).toBe(0);
      expect(result.percentageWithFiveOrFewerGames).toBe(0);
      expect(result.reasoning).toContain('No teams found');
    });

    it('should throw error for invalid teams data', async () => {
      await expect(activationConditionCalculator.calculateActivationConditionFromTeams(null as any))
        .rejects.toThrow('Teams data must be an array');

      await expect(activationConditionCalculator.calculateActivationConditionFromTeams('invalid' as any))
        .rejects.toThrow('Teams data must be an array');
    });
  });

  describe('isActivationConditionMet', () => {
    it('should return boolean result for condition check', async () => {
      const fixtureData: FixtureDataResult = {
        teams: [
          { teamId: 1, teamName: 'Team1', remainingGames: 3 },
          { teamId: 2, teamName: 'Team2', remainingGames: 7 }
        ],
        totalTeams: 2,
        teamsWithFiveOrFewerGames: 1,
        percentageWithFiveOrFewerGames: 50
      };

      const result = await activationConditionCalculator.isActivationConditionMet(fixtureData);
      expect(result).toBe(false);

      const resultWithCustomThreshold = await activationConditionCalculator.isActivationConditionMet(fixtureData, 50);
      expect(resultWithCustomThreshold).toBe(true);
    });
  });

  describe('_generateReasoning', () => {
    it('should generate appropriate reasoning for met condition', () => {
      const reasoning = activationConditionCalculator._generateReasoning(true, 10, 6, 60, 60);
      expect(reasoning).toContain('6/10 teams (60.0%) have ≤5 games remaining');
      expect(reasoning).toContain('meets the 60% threshold');
    });

    it('should generate appropriate reasoning for unmet condition', () => {
      const reasoning = activationConditionCalculator._generateReasoning(false, 10, 5, 50, 60);
      expect(reasoning).toContain('5/10 teams (50.0%) have ≤5 games remaining');
      expect(reasoning).toContain('does not meet the 60% threshold');
    });
  });

  describe('constants', () => {
    it('should export the correct activation threshold', () => {
      expect(ACTIVATION_THRESHOLD).toBe(60);
    });
  });
}); 