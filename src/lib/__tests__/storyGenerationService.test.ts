import {
  analyzeDramaticMoments,
  analyzePlayerPerformances,
  generateMatchStory,
  generateLeagueStories,
  type MatchStory,
} from '../storyGenerationService';
import type {
  ApiEvent,
  ApiPlayerMatchStats,
  ApiFixtureResponseItem,
} from '@/services/football-api/types';

describe('Story Generation Service', () => {
  // Mock data for testing
  const mockEvents: ApiEvent[] = [
    {
      time: { elapsed: 23, extra: null },
      team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
      player: { id: 123, name: 'Marcus Rashford' },
      assist: { id: 456, name: 'Bruno Fernandes' },
      type: 'Goal',
      detail: 'Normal Goal',
      comments: null,
    },
    {
      time: { elapsed: 89, extra: 2 },
      team: { id: 34, name: 'Liverpool', logo: 'logo2.png' },
      player: { id: 789, name: 'Mohamed Salah' },
      assist: null,
      type: 'Goal',
      detail: 'Normal Goal',
      comments: null,
    },
    {
      time: { elapsed: 45, extra: null },
      team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
      player: { id: 234, name: 'Harry Maguire' },
      assist: null,
      type: 'Card',
      detail: 'Yellow Card',
      comments: null,
    },
  ];

  const mockPlayerStats: ApiPlayerMatchStats[] = [
    {
      player: {
        id: 123,
        name: 'Marcus Rashford',
        firstname: 'Marcus',
        lastname: 'Rashford',
        age: 26,
        birth: { date: '1997-10-31', place: 'Manchester', country: 'England' },
        nationality: 'England',
        height: '180 cm',
        weight: '70 kg',
        injured: false,
        photo: 'photo.jpg',
      },
      statistics: [
        {
          games: {
            minutes: 90,
            number: 10,
            position: 'Attacker',
            rating: '8.5',
            captain: false,
            substitute: false,
          },
          offsides: 1,
          shots: { total: 4, on: 2 },
          goals: { total: 2, conceded: 0, assists: 1, saves: null },
          passes: { total: 32, key: 3, accuracy: '85%' },
          tackles: { total: 2, blocks: 0, interceptions: 1 },
          duels: { total: 8, won: 5 },
          dribbles: { attempts: 6, success: 4, past: null },
          fouls: { drawn: 2, committed: 1 },
          cards: { yellow: 0, red: 0 },
          penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: null },
        },
      ],
    },
    {
      player: {
        id: 789,
        name: 'Mohamed Salah',
        firstname: 'Mohamed',
        lastname: 'Salah',
        age: 31,
        birth: { date: '1992-06-15', place: 'Nagrig', country: 'Egypt' },
        nationality: 'Egypt',
        height: '175 cm',
        weight: '71 kg',
        injured: false,
        photo: 'photo2.jpg',
      },
      statistics: [
        {
          games: {
            minutes: 90,
            number: 11,
            position: 'Attacker',
            rating: '7.8',
            captain: false,
            substitute: false,
          },
          offsides: 0,
          shots: { total: 3, on: 1 },
          goals: { total: 1, conceded: 0, assists: 0, saves: null },
          passes: { total: 28, key: 2, accuracy: '82%' },
          tackles: { total: 1, blocks: 0, interceptions: 0 },
          duels: { total: 6, won: 3 },
          dribbles: { attempts: 4, success: 2, past: null },
          fouls: { drawn: 1, committed: 0 },
          cards: { yellow: 0, red: 0 },
          penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: null },
        },
      ],
    },
  ];

  const mockFixture: ApiFixtureResponseItem = {
    fixture: {
      id: 12345,
      referee: 'Michael Oliver',
      timezone: 'UTC',
      date: '2024-01-15T15:00:00+00:00',
      timestamp: 1705330800,
      periods: { first: 1705330800, second: 1705334400 },
      venue: { id: 556, name: 'Old Trafford', city: 'Manchester' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 39,
      name: 'Premier League',
      country: 'England',
      logo: 'league.png',
      flag: 'flag.png',
      season: 2024,
      round: 'Regular Season - 20',
    },
    teams: {
      home: { id: 33, name: 'Manchester United', logo: 'logo.png', winner: true },
      away: { id: 34, name: 'Liverpool', logo: 'logo2.png', winner: false },
    },
    goals: { home: 2, away: 1 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };

  describe('analyzeDramaticMoments', () => {
    it('should identify late goals', () => {
      const lateGoalEvents: ApiEvent[] = [
        {
          time: { elapsed: 89, extra: 2 },
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          player: { id: 123, name: 'Marcus Rashford' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
      ];

      const result = analyzeDramaticMoments(lateGoalEvents);

      expect(result.lateGoals).toHaveLength(1);
      expect(result.lateGoals[0].player.name).toBe('Marcus Rashford');
      expect(result.lateGoals[0].minute).toBe(91);
    });

    it('should identify comebacks', () => {
      const comebackEvents: ApiEvent[] = [
        // First goal for team A
        {
          time: { elapsed: 10, extra: null },
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          player: { id: 123, name: 'Marcus Rashford' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        // Two goals for team B (comeback)
        {
          time: { elapsed: 60, extra: null },
          team: { id: 34, name: 'Liverpool', logo: 'logo2.png' },
          player: { id: 789, name: 'Mohamed Salah' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: { elapsed: 75, extra: null },
          team: { id: 34, name: 'Liverpool', logo: 'logo2.png' },
          player: { id: 790, name: 'Sadio Mane' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
      ];

      const result = analyzeDramaticMoments(comebackEvents);

      expect(result.comebacks).toHaveLength(1);
      expect(result.comebacks[0].team).toBe('Liverpool');
      expect(result.comebacks[0].from).toBe(1);
      expect(result.comebacks[0].to).toBe(0);
    });

    it('should handle empty events', () => {
      const result = analyzeDramaticMoments([]);

      expect(result.lateGoals).toHaveLength(0);
      expect(result.comebacks).toHaveLength(0);
      expect(result.redCards).toHaveLength(0);
    });

    it('should identify red cards', () => {
      const redCardEvents: ApiEvent[] = [
        {
          time: { elapsed: 55, extra: null },
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          player: { id: 234, name: 'Harry Maguire' },
          assist: null,
          type: 'Card',
          detail: 'Red Card',
          comments: null,
        },
      ];

      const result = analyzeDramaticMoments(redCardEvents);

      expect(result.redCards).toHaveLength(1);
      expect(result.redCards[0].player.name).toBe('Harry Maguire');
    });
  });

  describe('analyzePlayerPerformances', () => {
    it('should identify top scorer', () => {
      const result = analyzePlayerPerformances(mockPlayerStats);

      expect(result.topScorer).toBeDefined();
      expect(result.topScorer?.name).toBe('Marcus Rashford');
      expect(result.topScorer?.goals).toBe(2);
    });

    it('should identify top assister', () => {
      const result = analyzePlayerPerformances(mockPlayerStats);

      expect(result.topAssister).toBeDefined();
      expect(result.topAssister?.name).toBe('Marcus Rashford');
      expect(result.topAssister?.assists).toBe(1);
    });

    it('should identify highest rated player', () => {
      const result = analyzePlayerPerformances(mockPlayerStats);

      expect(result.highestRated).toBeDefined();
      expect(result.highestRated?.name).toBe('Marcus Rashford');
      expect(result.highestRated?.rating).toBe(8.5);
    });

    it('should handle empty player stats', () => {
      const result = analyzePlayerPerformances([]);

      expect(result.topScorer).toBeNull();
      expect(result.topAssister).toBeNull();
      expect(result.highestRated).toBeNull();
    });

    it('should handle players with no goals', () => {
      const noGoalsStats: ApiPlayerMatchStats[] = [
        {
          player: {
            id: 123,
            name: 'Goalkeeper',
            firstname: 'Goal',
            lastname: 'Keeper',
            age: 30,
            birth: null,
            nationality: 'England',
            height: null,
            weight: null,
            injured: false,
            photo: null,
          },
          statistics: [
            {
              games: {
                minutes: 90,
                number: 1,
                position: 'Goalkeeper',
                rating: '7.0',
                captain: false,
                substitute: false,
              },
              offsides: null,
              shots: { total: 0, on: 0 },
              goals: { total: 0, conceded: 1, assists: 0, saves: 5 },
              passes: { total: 40, key: 0, accuracy: '90%' },
              tackles: { total: 0, blocks: 0, interceptions: 0 },
              duels: { total: 2, won: 1 },
              dribbles: { attempts: 0, success: 0, past: null },
              fouls: { drawn: 0, committed: 0 },
              cards: { yellow: 0, red: 0 },
              penalty: { won: 0, commited: 0, scored: 0, missed: 0, saved: 0 },
            },
          ],
        },
      ];

      const result = analyzePlayerPerformances(noGoalsStats);

      expect(result.topScorer).toBeNull();
    });
  });

  describe('generateMatchStory', () => {
    it('should generate a basic match story', () => {
      const result = generateMatchStory(mockFixture, mockEvents, mockPlayerStats);

      expect(result).toBeDefined();
      expect(result.headline).toContain('Manchester United');
      expect(result.headline).toContain('Liverpool');
      expect(result.content).toContain('defeated');
      expect(result.teams).toContain('Manchester United');
      expect(result.teams).toContain('Liverpool');
      expect(result.keyPlayers).toContain('Marcus Rashford');
    });

    it('should handle hat-trick scenario', () => {
      const hatTrickStats: ApiPlayerMatchStats[] = [
        {
          ...mockPlayerStats[0],
          statistics: [
            {
              ...mockPlayerStats[0].statistics[0],
              goals: { total: 3, conceded: 0, assists: 0, saves: null },
            },
          ],
        },
      ];

      const result = generateMatchStory(mockFixture, mockEvents, hatTrickStats);

      expect(result.headline).toContain('Hat-trick');
      expect(result.headline).toContain('Marcus Rashford');
      expect(result.category).toBe('performance');
    });

    it('should handle late drama scenario', () => {
      const lateGoalEvents: ApiEvent[] = [
        {
          time: { elapsed: 89, extra: 2 },
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          player: { id: 123, name: 'Marcus Rashford' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
      ];

      const result = generateMatchStory(mockFixture, lateGoalEvents, mockPlayerStats);

      expect(result.headline).toContain('Late Drama');
      expect(result.headline).toContain('Marcus Rashford');
      expect(result.category).toBe('drama');
    });

    it('should handle comeback scenario', () => {
      const comebackEvents: ApiEvent[] = [
        {
          time: { elapsed: 10, extra: null },
          team: { id: 34, name: 'Liverpool', logo: 'logo2.png' },
          player: { id: 789, name: 'Mohamed Salah' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: { elapsed: 60, extra: null },
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          player: { id: 123, name: 'Marcus Rashford' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
        {
          time: { elapsed: 75, extra: null },
          team: { id: 33, name: 'Manchester United', logo: 'logo.png' },
          player: { id: 124, name: 'Bruno Fernandes' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
          comments: null,
        },
      ];

      const result = generateMatchStory(mockFixture, comebackEvents, mockPlayerStats);

      expect(result.headline).toContain('Comeback');
      expect(result.category).toBe('drama');
    });

    it('should classify match importance correctly', () => {
      const result = generateMatchStory(mockFixture, mockEvents, mockPlayerStats);

      // Should be high importance for Man United vs Liverpool
      expect(['high', 'medium', 'low']).toContain(result.importance);
    });
  });

  describe('generateLeagueStories', () => {
    const mockMatchStories: MatchStory[] = [
      {
        headline: 'Manchester United 2-1 Liverpool',
        content: 'Manchester United defeated Liverpool 2-1 in a thrilling encounter.',
        category: 'drama',
        importance: 'high',
        teams: ['Manchester United', 'Liverpool'],
        keyPlayers: ['Marcus Rashford', 'Mohamed Salah'],
      },
      {
        headline: 'Arsenal 3-0 Chelsea',
        content: 'Arsenal dominated Chelsea with a comprehensive 3-0 victory.',
        category: 'performance',
        importance: 'medium',
        teams: ['Arsenal', 'Chelsea'],
        keyPlayers: ['Bukayo Saka'],
      },
    ];

    it('should generate league stories', () => {
      const result = generateLeagueStories(mockMatchStories, 'Gameweek 20');

      expect(result.roundSummary).toContain('Gameweek 20');
      expect(result.topStories).toHaveLength(2);
      expect(result.topStories[0].importance).toBe('high'); // Should be sorted by importance
    });

    it('should generate week highlights', () => {
      const result = generateLeagueStories(mockMatchStories, 'Gameweek 20');

      expect(result.weekHighlights).toBeDefined();
      expect(result.weekHighlights.performanceOfTheWeek).toContain('Arsenal');
      expect(result.weekHighlights.upsetOfTheWeek).toContain('Manchester United');
    });

    it('should handle empty stories array', () => {
      const result = generateLeagueStories([], 'Gameweek 20');

      expect(result.roundSummary).toContain('quiet');
      expect(result.topStories).toHaveLength(0);
      expect(result.weekHighlights.goalOfTheWeek).toBeUndefined();
    });

    it('should sort stories by importance', () => {
      const mixedImportanceStories: MatchStory[] = [
        {
          headline: 'Low importance match',
          content: 'Content',
          category: 'form',
          importance: 'low',
          teams: ['Team A', 'Team B'],
          keyPlayers: [],
        },
        {
          headline: 'High importance match',
          content: 'Content',
          category: 'upset',
          importance: 'high',
          teams: ['Team C', 'Team D'],
          keyPlayers: [],
        },
        {
          headline: 'Medium importance match',
          content: 'Content',
          category: 'performance',
          importance: 'medium',
          teams: ['Team E', 'Team F'],
          keyPlayers: [],
        },
      ];

      const result = generateLeagueStories(mixedImportanceStories, 'Gameweek 1');

      expect(result.topStories[0].importance).toBe('high');
      expect(result.topStories[1].importance).toBe('medium');
      expect(result.topStories[2].importance).toBe('low');
    });
  });
}); 