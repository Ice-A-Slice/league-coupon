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

export interface UpcomingFixture {
  id: number;
  homeTeam: {
    name: string;
    logo?: string;
    form?: string;
  };
  awayTeam: {
    name: string;
    logo?: string;
    form?: string;
  };
  kickoffTime: string;
  venue?: string;
  importance?: 'low' | 'medium' | 'high';
}

export interface NextRoundPreview {
  roundNumber: number;
  keyFixtures: UpcomingFixture[];
  aiAnalysis: {
    excitement: string; // Why this round is exciting
    keyMatchups: string[]; // Specific fixture previews
    predictions: string; // AI prediction insights
  };
}

export interface SummaryEmailProps {
  user: UserPerformance;
  roundNumber: number;
  matches: MatchResult[];
  leagueStandings: LeagueStanding[];
  aiStories: AIGeneratedStory[];
  nextRoundPreview?: NextRoundPreview;
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
  nextRoundPreview,
  weekHighlights,
  appUrl = baseUrl,
}) => {
  const positionChange = user.previousPosition
    ? user.previousPosition - user.currentPosition  // Fixed: lower position number is better
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

          {/* Coming Up Next - Next Round Preview */}
          {nextRoundPreview && (
            <Section style={section}>
              <Heading style={h2}>🔮 Coming Up Next: Round {String(nextRoundPreview.roundNumber)}</Heading>
              
              <div style={nextRoundCard}>
                <Text style={nextRoundExcitement}>{nextRoundPreview.aiAnalysis.excitement}</Text>
              </div>

              {/* Key Fixtures */}
              <Heading style={h3}>Key Fixtures</Heading>
              <div style={matchGrid}>
                {nextRoundPreview.keyFixtures.map((fixture) => (
                  <div key={fixture.id} style={fixtureCard}>
                    <Text style={fixtureTeams}>{fixture.homeTeam.name} vs {fixture.awayTeam.name}</Text>
                    <Text style={fixtureDetails}>
                      {new Date(fixture.kickoffTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {fixture.importance === 'high' && (
                      <Text style={importanceBadge}>🔥 High Importance</Text>
                    )}
                  </div>
                ))}
              </div>

              {/* AI Analysis */}
              <div style={nextRoundCard}>
                <Heading style={h3}>AI Breakdown</Heading>
                {nextRoundPreview.aiAnalysis.keyMatchups.map((matchup, index) => (
                  <Text key={index} style={aiAnalysisText}>- {matchup}</Text>
                ))}
                <Hr style={hr} />
                <Text style={aiPredictionText}><strong>🔮 AI Prediction Tip:</strong> {nextRoundPreview.aiAnalysis.predictions}</Text>
              </div>
            </Section>
          )}

          {/* Call to Action */}
          <Section style={ctaSection}>
            <Heading style={h2}>Ready for the next round?</Heading>
            <Button 
              style={button} 
              href={`${appUrl}?utm_source=email&utm_medium=summary&utm_campaign=round_${String(roundNumber)}`}
              data-testid="summary-email-cta"
            >
              {nextRoundPreview ? 'Make Your Predictions' : 'View League & Make Predictions'}
            </Button>
          </Section>
          
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you are a user of the Premier League Coupon app.
              <br />
              This is an automated summary. For any issues, please contact support.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f3f4f6',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '100%',
  maxWidth: '600px',
};

const header = {
  padding: '0 30px',
  textAlign: 'center' as const,
  marginBottom: '20px',
};

const h1 = {
  color: '#1f2937',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 10px 0',
};

const h2 = {
  fontSize: '24px',
  fontWeight: 'bold',
  marginBottom: '20px',
  color: '#1f2937',
};

const h3 = {
  fontSize: '20px',
  fontWeight: 'bold',
  marginTop: '20px',
  marginBottom: '10px',
  color: '#374151',
};

const headerSubtext = {
  fontSize: '14px',
  color: '#6b7280',
};

const section = {
  padding: '0 30px',
  marginBottom: '30px',
};

const performanceCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
};

const performanceColumn = {
  width: '50%',
  textAlign: 'center' as const,
};

const performanceStat = {
  margin: '0 0 5px 0',
};

const performanceLabel = {
  fontSize: '14px',
  color: '#6b7280',
};

const performanceChange = {
  fontSize: '14px',
  fontWeight: '500',
  margin: '0',
};

const performanceDetails = {
  fontSize: '14px',
  color: '#6b7280',
  textAlign: 'center' as const,
  margin: '5px 0 0 0',
};

const bestPrediction = {
  marginTop: '20px',
  textAlign: 'center' as const,
  fontSize: '14px',
  color: '#374151',
  padding: '10px',
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
};

const storyCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
};

const storyHeadline = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 8px 0',
};

const storyContent = {
  fontSize: '14px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: '0',
};

const aiAnalysisText = {
  ...storyContent,
  marginBottom: '10px',
};

const aiPredictionText = {
  ...storyContent,
  fontStyle: 'italic',
  backgroundColor: '#f9fafb',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #f3f4f6',
};

const matchGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
};

const matchCard = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '15px',
  textAlign: 'center' as const,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  marginBottom: '10px', // For single column layout
};

const fixtureCard = {
  ...matchCard,
  border: '1px solid #e5e7eb',
};

const matchTeams = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const teamName = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
  margin: '0 0 5px 0',
};

const fixtureTeams = {
  fontSize: '15px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 8px 0',
};

const fixtureDetails = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0',
};

const matchScore = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 10px',
};

const dramaticBadge = {
  display: 'inline-block',
  backgroundColor: '#fef2f2',
  color: '#dc2626',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: '500',
  marginTop: '10px',
};

const importanceBadge = {
  ...dramaticBadge,
  backgroundColor: '#fffbeb',
  color: '#d97706',
  marginTop: '12px',
};

const tableContainer = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden',
};

const tableRow = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 15px',
  borderBottom: '1px solid #e5e7eb',
};

const tablePosition = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#6b7280',
  width: '30px',
};

const tableTeam = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#1f2937',
  flex: '1',
};

const tablePoints = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1f2937',
  width: '60px',
  textAlign: 'right' as const,
};

const tableStats = {
  fontSize: '12px',
  color: '#6b7280',
  width: '120px',
  textAlign: 'right' as const,
};

const highlightsCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px',
};

const highlight = {
  fontSize: '14px',
  color: '#374151',
  margin: '0 0 8px 0',
};

const nextRoundCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
};

const nextRoundExcitement = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0',
  fontStyle: 'italic',
};

const ctaSection = {
  textAlign: 'center' as const,
  padding: '30px',
};

const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '14px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '16px',
  display: 'inline-block',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  textAlign: 'center' as const,
  marginTop: '20px',
};

const footerText = {
  lineHeight: '1.5',
};

export default SummaryEmail; 