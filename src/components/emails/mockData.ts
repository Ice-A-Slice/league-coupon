import {
  SummaryEmailProps,
  ReminderEmailProps,
} from './index';

// Mock Data for Summary Email
export const mockSummaryData: SummaryEmailProps = {
  user: {
    name: 'Alex Johnson',
    currentPosition: 3,
    previousPosition: 5,
    pointsEarned: 8,
    totalPoints: 127,
    correctPredictions: 6,
    totalPredictions: 10,
    bestPrediction: 'Arsenal 2-1 Liverpool (exact score)',
  },
  roundNumber: 15,
  matches: [
    {
      id: 1,
      homeTeam: {
        name: 'Arsenal',
        score: 2,
      },
      awayTeam: {
        name: 'Liverpool',
        score: 1,
      },
      status: 'FT',
      dramatic: true,
    },
    {
      id: 2,
      homeTeam: {
        name: 'Manchester City',
        score: 3,
      },
      awayTeam: {
        name: 'Manchester United',
        score: 0,
      },
      status: 'FT',
    },
    {
      id: 3,
      homeTeam: {
        name: 'Chelsea',
        score: 1,
      },
      awayTeam: {
        name: 'Tottenham',
        score: 1,
      },
      status: 'FT',
    },
    {
      id: 4,
      homeTeam: {
        name: 'Newcastle',
        score: 2,
      },
      awayTeam: {
        name: 'Brighton',
        score: 0,
      },
      status: 'FT',
    },
    {
      id: 5,
      homeTeam: {
        name: 'Sheffield United',
        score: 3,
      },
      awayTeam: {
        name: 'Luton Town',
        score: 2,
      },
      status: 'FT',
      dramatic: true,
    },
  ],
  leagueStandings: [
    {
      position: 1,
      teamName: 'Liverpool',
      points: 45,
      played: 20,
      won: 14,
      drawn: 3,
      lost: 3,
      goalDifference: 28,
    },
    {
      position: 2,
      teamName: 'Arsenal',
      points: 43,
      played: 20,
      won: 13,
      drawn: 4,
      lost: 3,
      goalDifference: 24,
    },
    {
      position: 3,
      teamName: 'Manchester City',
      points: 40,
      played: 19,
      won: 12,
      drawn: 4,
      lost: 3,
      goalDifference: 22,
    },
    {
      position: 4,
      teamName: 'Aston Villa',
      points: 39,
      played: 20,
      won: 12,
      drawn: 3,
      lost: 5,
      goalDifference: 15,
    },
    {
      position: 5,
      teamName: 'Tottenham',
      points: 36,
      played: 20,
      won: 11,
      drawn: 3,
      lost: 6,
      goalDifference: 8,
    },
    {
      position: 6,
      teamName: 'West Ham',
      points: 33,
      played: 20,
      won: 10,
      drawn: 3,
      lost: 7,
      goalDifference: 5,
    },
  ],
  aiStories: [
    {
      headline: '🔥 Arsenal Stuns Liverpool in Title Race Thriller',
      content: 'In a match that had everything, Arsenal proved they mean business in this year\'s title race with a dramatic 2-1 victory over Liverpool. Despite going behind early, the Gunners showed incredible character to turn it around in the second half, with Bukayo Saka sealing the victory in the 89th minute.',
      type: 'title_race',
    },
    {
      headline: '😱 Sheffield United\'s Great Escape Continues',
      content: 'Bottom-placed Sheffield United provided another twist in their remarkable survival story, coming from 2-0 down to beat Luton Town 3-2. Their never-say-die attitude is keeping their Premier League dreams alive against all odds.',
      type: 'drama',
    },
    {
      headline: '⚡ Manchester Derby Dominance',
      content: 'Manchester City reminded everyone why they\'re champions with a commanding 3-0 victory over their city rivals. The performance was a statement of intent as they close the gap on the league leaders.',
      type: 'performance',
    },
  ],
  nextRoundPreview: {
    roundNumber: 16,
    keyFixtures: [
      {
        id: 101,
        homeTeam: {
          name: 'Liverpool',
          form: 'WWDLW',
        },
        awayTeam: {
          name: 'Manchester City',
          form: 'WWWDW',
        },
        kickoffTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        venue: 'Anfield',
        importance: 'high',
      },
      {
        id: 102,
        homeTeam: {
          name: 'Arsenal',
          form: 'LWWWW',
        },
        awayTeam: {
          name: 'Chelsea',
          form: 'DWLWL',
        },
        kickoffTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        venue: 'Emirates Stadium',
        importance: 'high',
      },
      {
        id: 103,
        homeTeam: {
          name: 'Tottenham',
          form: 'WLDWW',
        },
        awayTeam: {
          name: 'Newcastle',
          form: 'DLWWL',
        },
        kickoffTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Tottenham Hotspur Stadium',
        importance: 'medium',
      },
    ],
    aiAnalysis: {
      excitement: 'Round 16 promises to be explosive! The title race takes center stage with Liverpool hosting Manchester City at Anfield - a match that could define the season. Meanwhile, Arsenal look to maintain their momentum against a Chelsea side desperate for points.',
      keyMatchups: [
        'Liverpool vs Manchester City: The clash of titans at Anfield could swing the title race. Both teams are in excellent form, making this the most unpredictable fixture of the round.',
        'Arsenal vs Chelsea: The North London powerhouse meets the inconsistent Blues. Arsenal\'s home fortress has been impenetrable, but Chelsea\'s attacking talent could cause problems.',
      ],
      predictions: 'Focus on home advantage this round - Liverpool and Arsenal both have fortress-like records at home. Manchester City\'s away form will be crucial, while Chelsea\'s inconsistency makes them a risky pick.',
    },
  },
  weekHighlights: {
    topPerformer: 'Sarah Chen (12 points)',
    biggestUpset: 'Sheffield United 3-2 Luton Town',
    goalOfTheWeek: 'Bukayo Saka\'s curler vs Liverpool',
  },
  appUrl: 'https://your-app.com',
};

// Mock Data for Reminder Email
export const mockReminderData: ReminderEmailProps = {
  user: {
    name: 'Alex Johnson',
    currentPosition: 3,
    totalPlayers: 24,
    pointsBehindLeader: 18,
    pointsAheadOfNext: 4,
    recentForm: 'improving',
  },
  deadline: {
    roundNumber: 16,
    deadline: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(), // 23 hours from now
    timeRemaining: '23 hours, 15 minutes',
    isUrgent: false,
  },
  fixtures: [
    {
      id: 1,
      homeTeam: {
        name: 'Liverpool',
        form: 'WWDLW',
      },
      awayTeam: {
        name: 'Manchester City',
        form: 'WWWDW',
      },
      kickoffTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      venue: 'Anfield',
      importance: 'high',
    },
    {
      id: 2,
      homeTeam: {
        name: 'Arsenal',
        form: 'LWWWW',
      },
      awayTeam: {
        name: 'Chelsea',
        form: 'DWLWL',
      },
      kickoffTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      venue: 'Emirates Stadium',
      importance: 'high',
    },
    {
      id: 3,
      homeTeam: {
        name: 'Tottenham',
        form: 'WLDWW',
      },
      awayTeam: {
        name: 'Newcastle',
        form: 'DLWWL',
      },
      kickoffTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
      venue: 'Tottenham Hotspur Stadium',
      importance: 'medium',
    },
    {
      id: 4,
      homeTeam: {
        name: 'Brighton',
        form: 'DLWDL',
      },
      awayTeam: {
        name: 'West Ham',
        form: 'LWDWW',
      },
      kickoffTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      importance: 'low',
    },
    {
      id: 5,
      homeTeam: {
        name: 'Sheffield United',
        form: 'LLLWL',
      },
      awayTeam: {
        name: 'Burnley',
        form: 'WLLLD',
      },
      kickoffTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      importance: 'medium',
    },
  ],
  aiContent: {
    personalMessage: 'Hey Alex! You\'re on fire with your recent predictions! 🔥 Your improving form has you climbing the table, and you\'re just 18 points behind the leader. This round could be crucial for your title challenge.',
    strategyTip: 'Focus on the big matches this weekend - Liverpool vs City could be a title decider, and your prediction here could make or break your round.',
    fixtureInsight: 'Arsenal vs Chelsea is always unpredictable, but Arsenal\'s home form has been exceptional. Consider backing the Gunners to continue their winning streak.',
    encouragement: 'You\'re in great form and climbing fast! Trust your instincts and keep building that momentum. The top spot is within reach! 🚀',
  },
  keyMatches: [
    {
      id: 1,
      homeTeam: {
        name: 'Liverpool',
        form: 'WWDLW',
      },
      awayTeam: {
        name: 'Manchester City',
        form: 'WWWDW',
      },
      kickoffTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      venue: 'Anfield',
      importance: 'high',
    },
    {
      id: 2,
      homeTeam: {
        name: 'Arsenal',
        form: 'LWWWW',
      },
      awayTeam: {
        name: 'Chelsea',
        form: 'DWLWL',
      },
      kickoffTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      venue: 'Emirates Stadium',
      importance: 'high',
    },
  ],
  leagueContext: {
    averageScore: 6,
    topScore: 12,
    yourLastRoundScore: 8,
  },
  appUrl: 'https://your-app.com',
};

// Mock Data for Urgent Reminder (less than 24 hours)
export const mockUrgentReminderData: ReminderEmailProps = {
  ...mockReminderData,
  deadline: {
    roundNumber: 16,
    deadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
    timeRemaining: '4 hours, 43 minutes',
    isUrgent: true,
  },
  aiContent: {
    personalMessage: 'URGENT: Alex, you only have 4 hours and 43 minutes left to submit your Round 16 predictions! ⏰ Don\'t let this crucial round slip away.',
    strategyTip: 'With limited time, focus on the matches you feel most confident about. Liverpool vs City is the big one - what\'s your gut feeling?',
    fixtureInsight: 'Quick tip: Arsenal have won their last 4 home games, while Chelsea are inconsistent away from home.',
    encouragement: 'Time is running out, but you\'ve got this! Make your picks now and keep that winning streak alive! 🚀',
  },
}; 