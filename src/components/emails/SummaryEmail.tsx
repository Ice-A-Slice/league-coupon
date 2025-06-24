import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
  Heading,
  Text,
  Button,
  Hr,
} from '@react-email/components';
import * as React from 'react';

// TypeScript interfaces for the email data
export interface MatchResult {
  id: number;
  homeTeam: {
    name: string;
    logo?: string;
    score: number;
  };
  awayTeam: {
    name: string;
    logo?: string;
    score: number;
  };
  status: string;
  dramatic?: boolean; // For AI-highlighted dramatic matches
}

export interface UserPerformance {
  name: string;
  currentPosition: number;
  previousPosition?: number;
  pointsEarned: number;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
  bestPrediction?: string;
}

export interface LeagueStanding {
  position: number;
  teamName: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
}

export interface AIGeneratedStory {
  headline: string;
  content: string;
  type: 'upset' | 'drama' | 'performance' | 'title_race' | 'form';
}

export interface SummaryEmailProps {
  user: UserPerformance;
  roundNumber: number;
  matches: MatchResult[];
  leagueStandings: LeagueStanding[];
  aiStories: AIGeneratedStory[];
  weekHighlights?: {
    topPerformer: string;
    biggestUpset: string;
    goalOfTheWeek?: string;
  };
  appUrl: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const SummaryEmail: React.FC<SummaryEmailProps> = ({
  user,
  roundNumber,
  matches,
  leagueStandings,
  aiStories,
  weekHighlights,
  appUrl = baseUrl,
}) => {
  const positionChange = user.previousPosition 
    ? user.currentPosition - user.previousPosition 
    : 0;

  const getPositionChangeText = () => {
    if (positionChange > 0) return `⬆️ Up ${positionChange} ${positionChange === 1 ? 'place' : 'places'}!`;
    if (positionChange < 0) return `⬇️ Down ${Math.abs(positionChange)} ${Math.abs(positionChange) === 1 ? 'place' : 'places'}`;
    return '➡️ Position unchanged';
  };

  const getPositionChangeColor = () => {
    if (positionChange > 0) return '#22c55e'; // green
    if (positionChange < 0) return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  return (
    <Html>
      <Head />
      <Preview>
        Round {String(roundNumber)} Summary: {aiStories[0]?.headline || 'Premier League Results & Your Performance'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>⚽ Premier League Round {String(roundNumber)}</Heading>
            <Text style={headerSubtext}>Your weekly summary & league highlights</Text>
          </Section>

          {/* Personal Performance Section */}
          <Section style={section}>
            <Heading style={h2}>🎯 Your Performance, {user.name}</Heading>
            <div style={performanceCard}>
              <Row>
                <Column style={performanceColumn}>
                  <Text style={performanceStat}>
                    <strong style={{ fontSize: '24px', color: '#1f2937' }}>#{user.currentPosition}</strong><br/>
                    <span style={performanceLabel}>Current Position</span>
                  </Text>
                  <Text style={{ ...performanceChange, color: getPositionChangeColor() }}>
                    {getPositionChangeText()}
                  </Text>
                </Column>
                <Column style={performanceColumn}>
                  <Text style={performanceStat}>
                    <strong style={{ fontSize: '24px', color: '#059669' }}>+{String(user.pointsEarned)}</strong><br/>
                    <span style={performanceLabel}>Points This Round</span>
                  </Text>
                  <Text style={performanceDetails}>
                                          {String(user.correctPredictions)}/{String(user.totalPredictions)} correct predictions
                  </Text>
                </Column>
              </Row>
              {user.bestPrediction && (
                <Text style={bestPrediction}>
                  🏆 <strong>Best Prediction:</strong> {user.bestPrediction}
                </Text>
              )}
            </div>
          </Section>

          {/* AI-Generated League Stories */}
          {aiStories.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>📰 This Round&apos;s Stories</Heading>
              {aiStories.slice(0, 3).map((story, index) => (
                <div key={index} style={storyCard}>
                  <Text style={storyHeadline}>{story.headline}</Text>
                  <Text style={storyContent}>{story.content}</Text>
                </div>
              ))}
            </Section>
          )}

          {/* Match Results */}
          <Section style={section}>
            <Heading style={h2}>📊 Match Results</Heading>
            <div style={matchGrid}>
              {matches.map((match) => (
                <div key={match.id} style={matchCard}>
                  <div style={matchTeams}>
                    <Text style={teamName}>{match.homeTeam.name}</Text>
                    <Text style={matchScore}>
                      {String(match.homeTeam.score)} - {String(match.awayTeam.score)}
                    </Text>
                    <Text style={teamName}>{match.awayTeam.name}</Text>
                  </div>
                  {match.dramatic && (
                    <Text style={dramaticBadge}>⚡ Dramatic</Text>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* League Table (Top 6) */}
          <Section style={section}>
            <Heading style={h2}>🏆 League Table (Top 6)</Heading>
            <div style={tableContainer}>
              {leagueStandings.slice(0, 6).map((team) => (
                <div key={team.position} style={tableRow}>
                  <Text style={tablePosition}>{String(team.position)}</Text>
                  <Text style={tableTeam}>{team.teamName}</Text>
                                      <Text style={tablePoints}>{String(team.points)} pts</Text>
                                      <Text style={tableStats}>{String(team.played)}p {String(team.won)}w {String(team.drawn)}d {String(team.lost)}l</Text>
                </div>
              ))}
            </div>
          </Section>

          {/* Week Highlights */}
          {weekHighlights && (
            <Section style={section}>
              <Heading style={h2}>✨ Week Highlights</Heading>
              <div style={highlightsCard}>
                <Text style={highlight}>🥇 <strong>Top Performer:</strong> {weekHighlights.topPerformer}</Text>
                <Text style={highlight}>😱 <strong>Biggest Upset:</strong> {weekHighlights.biggestUpset}</Text>
                {weekHighlights.goalOfTheWeek && (
                  <Text style={highlight}>⚽ <strong>Goal of the Week:</strong> <span dangerouslySetInnerHTML={{ __html: weekHighlights.goalOfTheWeek.replace(/'/g, '&apos;') }} /></Text>
                )}
              </div>
            </Section>
          )}

          {/* Call to Action */}
          <Section style={section}>
            <div style={ctaContainer}>
              <Heading style={h3}>Ready for the next round?</Heading>
              <Text style={ctaText}>
                The next round opens soon. Make your predictions and climb the leaderboard!
              </Text>
              <Button style={button} href={`${appUrl}?utm_source=email&utm_medium=summary&utm_campaign=round_${String(roundNumber)}`}>
                View League & Make Predictions
              </Button>
            </div>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
            <Text style={footerText}>
              You&apos;re receiving this because you&apos;re part of our Premier League prediction league.
              <br />
              <a href={`${appUrl}/unsubscribe`} style={footerLink}>Unsubscribe</a> | 
              <a href={`${appUrl}/settings`} style={footerLink}>Email Preferences</a>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 24px',
  backgroundColor: '#1f2937',
  borderRadius: '8px 8px 0 0',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
};

const headerSubtext = {
  color: '#d1d5db',
  fontSize: '16px',
  textAlign: 'center' as const,
  margin: '0',
};

const section = {
  padding: '24px',
};

const h2 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
};

const h3 = {
  color: '#1f2937',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const performanceCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '16px',
};

const performanceColumn = {
  width: '50%',
  textAlign: 'center' as const,
};

const performanceStat = {
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
};

const performanceLabel = {
  color: '#6b7280',
  fontSize: '14px',
};

const performanceChange = {
  fontSize: '14px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0',
};

const performanceDetails = {
  color: '#6b7280',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0',
};

const bestPrediction = {
  backgroundColor: '#fef3c7',
  border: '1px solid #f59e0b',
  borderRadius: '6px',
  padding: '12px',
  margin: '16px 0 0 0',
  fontSize: '14px',
};

const storyCard = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #0ea5e9',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
};

const storyHeadline = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#0c4a6e',
  margin: '0 0 8px 0',
};

const storyContent = {
  fontSize: '16px',
  color: '#374151',
  margin: '0',
  lineHeight: '1.5',
};

const matchGrid = {
  display: 'grid',
  gap: '12px',
};

const matchCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '16px',
};

const matchTeams = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '8px',
};

const teamName = {
  fontSize: '16px',
  fontWeight: '500',
  color: '#1f2937',
  margin: '0',
  flex: '1',
};

const matchScore = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#059669',
  margin: '0 16px',
  textAlign: 'center' as const,
};

const dramaticBadge = {
  backgroundColor: '#fbbf24',
  color: '#92400e',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '4px 8px',
  borderRadius: '4px',
  textAlign: 'center' as const,
  margin: '0',
};

const tableContainer = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden',
};

const tableRow = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid #f3f4f6',
};

const tablePosition = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  width: '40px',
  margin: '0',
};

const tableTeam = {
  fontSize: '16px',
  color: '#1f2937',
  flex: '1',
  margin: '0',
};

const tablePoints = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#059669',
  width: '60px',
  textAlign: 'right' as const,
  margin: '0',
};

const tableStats = {
  fontSize: '14px',
  color: '#6b7280',
  width: '120px',
  textAlign: 'right' as const,
  margin: '0',
};

const highlightsCard = {
  backgroundColor: '#fef7ff',
  border: '1px solid #c084fc',
  borderRadius: '8px',
  padding: '16px',
};

const highlight = {
  fontSize: '16px',
  color: '#374151',
  margin: '0 0 8px 0',
  lineHeight: '1.5',
};

const ctaContainer = {
  textAlign: 'center' as const,
  padding: '24px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
};

const ctaText = {
  fontSize: '16px',
  color: '#6b7280',
  margin: '0 0 20px 0',
  lineHeight: '1.5',
};

const button = {
  backgroundColor: '#059669',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  fontWeight: 'bold',
};

const footer = {
  padding: '24px',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '0 0 20px 0',
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0',
  lineHeight: '1.5',
};

const footerLink = {
  color: '#059669',
  textDecoration: 'underline',
  margin: '0 8px',
};

export default SummaryEmail; 