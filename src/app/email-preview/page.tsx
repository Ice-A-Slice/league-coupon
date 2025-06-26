'use client';

import React, { useState, useEffect } from 'react';
import { SummaryEmail, type SummaryEmailProps } from '@/components/emails/SummaryEmail';
import { ReminderEmail, type ReminderEmailProps } from '@/components/emails/ReminderEmail';
import { Button } from '@/components/ui/button';

// Sample data for Summary Email
const sampleSummaryData: SummaryEmailProps = {
  user: {
    name: "Test User",
    currentPosition: 3,
    previousPosition: 5,
    pointsEarned: 15,
    totalPoints: 127,
    correctPredictions: 3,
    totalPredictions: 5,
    bestPrediction: "Arsenal 2-1 Chelsea (Perfect Score!)"
  },
  roundNumber: 5,
  matches: [
    {
      id: 101,
      homeTeam: { name: "Arsenal", logo: "", score: 2 },
      awayTeam: { name: "Chelsea", logo: "", score: 1 },
      status: "FINISHED",
      dramatic: true
    },
    {
      id: 102,
      homeTeam: { name: "Liverpool", logo: "", score: 1 },
      awayTeam: { name: "Manchester City", logo: "", score: 3 },
      status: "FINISHED"
    },
    {
      id: 103,
      homeTeam: { name: "Manchester United", logo: "", score: 0 },
      awayTeam: { name: "Tottenham", logo: "", score: 2 },
      status: "FINISHED",
      dramatic: true
    }
  ],
  leagueStandings: [
    { position: 1, teamName: "Manchester City", points: 15, played: 5, won: 5, drawn: 0, lost: 0, goalDifference: 12 },
    { position: 2, teamName: "Arsenal", points: 12, played: 5, won: 4, drawn: 0, lost: 1, goalDifference: 8 },
    { position: 3, teamName: "Liverpool", points: 10, played: 5, won: 3, drawn: 1, lost: 1, goalDifference: 5 },
    { position: 4, teamName: "Tottenham", points: 9, played: 5, won: 3, drawn: 0, lost: 2, goalDifference: 3 },
    { position: 5, teamName: "Chelsea", points: 6, played: 5, won: 2, drawn: 0, lost: 3, goalDifference: -2 }
  ],
  aiStories: [
    {
      headline: "Arsenal's Statement Victory Shakes Title Race",
      content: "Arsenal delivered a masterclass performance against Chelsea, showcasing the tactical brilliance that has propelled them up the table. The 2-1 victory wasn't just about the scoreline—it was about sending a message to the rest of the league.",
      type: "title_race"
    },
    {
      headline: "Tottenham's Resurgence Continues",
      content: "Spurs' 2-0 victory over Manchester United demonstrates their growing confidence under new management. The clinical finishing and solid defensive display suggest this team is ready to challenge for European spots.",
      type: "performance"
    }
  ],
  nextRoundPreview: {
    roundNumber: 6,
    keyFixtures: [
      {
        id: 201,
        homeTeam: { name: "Manchester City", form: "WWWWW" },
        awayTeam: { name: "Arsenal", form: "WWLWW" },
        kickoffTime: "2024-02-22T16:30:00Z",
        venue: "Etihad Stadium",
        importance: "high"
      }
    ],
    aiAnalysis: {
      excitement: "The blockbuster clash between Manchester City and Arsenal could define the title race!",
      keyMatchups: ["De Bruyne vs Odegaard in midfield", "Haaland vs Saliba defensive battle"],
      predictions: "Expect goals, drama, and possibly the performance of the season from both teams."
    }
  },
  weekHighlights: {
    topPerformer: "Bukayo Saka (2 goals, 1 assist)",
    biggestUpset: "Tottenham 2-0 Manchester United",
    goalOfTheWeek: "Kevin De Bruyne's curling masterpiece"
  },
  appUrl: "https://localhost:3000"
};

// Sample data for Reminder Email
const sampleReminderData: ReminderEmailProps = {
  user: {
    name: "Test User",
    currentPosition: 3,
    totalPlayers: 25,
    pointsBehindLeader: 15,
    pointsAheadOfNext: 8,
    recentForm: "improving"
  },
  deadline: {
    roundNumber: 6,
    deadline: "2024-02-22T18:00:00Z",
    timeRemaining: "23 hours, 45 minutes",
    isUrgent: false
  },
  fixtures: [
    {
      id: 201,
      homeTeam: { name: "Manchester City", form: "WWWWW" },
      awayTeam: { name: "Arsenal", form: "WWLWW" },
      kickoffTime: "2024-02-22T16:30:00Z",
      venue: "Etihad Stadium",
      importance: "high"
    },
    {
      id: 202,
      homeTeam: { name: "Brighton", form: "WLDWL" },
      awayTeam: { name: "Newcastle", form: "LWDWW" },
      kickoffTime: "2024-02-23T15:00:00Z",
      venue: "American Express Stadium",
      importance: "medium"
    },
    {
      id: 203,
      homeTeam: { name: "Crystal Palace", form: "LLDWL" },
      awayTeam: { name: "Everton", form: "DWLLD" },
      kickoffTime: "2024-02-23T17:30:00Z",
      importance: "low"
    }
  ],
  aiContent: {
    personalMessage: "Your recent improvement puts you in perfect position to climb higher! With your sharp eye for upsets, this round could be your breakthrough moment.",
    strategyTip: "Manchester City vs Arsenal is the headline act, but don't overlook Brighton vs Newcastle - both teams have been unpredictable lately.",
    fixtureInsight: "Haaland has scored in 4 of his last 5 games against top-6 opposition - something to consider for your predictions!",
    encouragement: "You're only 15 points off the lead with plenty of rounds remaining. Every prediction counts!"
  },
  keyMatches: [
    {
      id: 201,
      homeTeam: { name: "Manchester City", form: "WWWWW" },
      awayTeam: { name: "Arsenal", form: "WWLWW" },
      kickoffTime: "2024-02-22T16:30:00Z",
      venue: "Etihad Stadium",
      importance: "high"
    }
  ],
  leagueContext: {
    averageScore: 8,
    topScore: 25,
    yourLastRoundScore: 15
  },
  appUrl: "https://localhost:3000"
};

export default function EmailPreviewPage() {
  const [emailType, setEmailType] = useState<'summary' | 'reminder'>('summary');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Email Preview</h1>
          <div className="text-center">Loading preview...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Email Preview</h1>
          <p className="text-gray-600 mb-6">
            Preview email templates with sample data. Use this during development to test email layouts and content.
          </p>
          
          <div className="flex gap-4 mb-6">
            <Button
              onClick={() => setEmailType('summary')}
              variant={emailType === 'summary' ? 'default' : 'outline'}
            >
              Summary Email
            </Button>
            <Button
              onClick={() => setEmailType('reminder')}
              variant={emailType === 'reminder' ? 'default' : 'outline'}
            >
              Reminder Email
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Preview: {emailType === 'summary' ? 'Round Summary' : 'Round Reminder'} Email
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              This preview shows how the email will look when sent to users
            </p>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            {emailType === 'summary' ? (
              <SummaryEmail {...sampleSummaryData} />
            ) : (
              <ReminderEmail {...sampleReminderData} />
            )}
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Development Notes</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• This preview uses sample data for development purposes</li>
            <li>• Email styling is optimized for email clients, so some CSS may not render perfectly in browsers</li>
            <li>• Test both email types to ensure consistency</li>
            <li>• For production testing, use the API endpoints with proper authentication</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 