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

// TypeScript interfaces for the reminder email data
export interface UpcomingFixture {
  id: number;
  homeTeam: {
    name: string;
    logo?: string;
    form?: string; // e.g., "WLWDD"
  };
  awayTeam: {
    name: string;
    logo?: string;
    form?: string;
  };
  kickoffTime: string;
  venue?: string;
  importance?: 'low' | 'medium' | 'high'; // For highlighting key matches
}

export interface UserPosition {
  name: string;
  currentPosition: number;
  totalPlayers: number;
  pointsBehindLeader: number;
  pointsAheadOfNext?: number;
  recentForm: 'improving' | 'declining' | 'steady';
}

export interface DeadlineInfo {
  roundNumber: number;
  deadline: string; // ISO date string
  timeRemaining: string; // e.g., "23 hours, 45 minutes"
  isUrgent: boolean; // Less than 24 hours
}

export interface AIMotivationalContent {
  personalMessage: string;
  strategyTip?: string;
  fixtureInsight?: string;
  encouragement: string;
}

export interface ReminderEmailProps {
  user: UserPosition;
  deadline: DeadlineInfo;
  fixtures: UpcomingFixture[];
  aiContent: AIMotivationalContent;
  keyMatches?: UpcomingFixture[]; // Highlighted important matches
  leagueContext?: {
    averageScore: number;
    topScore: number;
    yourLastRoundScore: number;
  };
  appUrl: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const ReminderEmail: React.FC<ReminderEmailProps> = ({
  user,
  deadline,
  fixtures,
  aiContent,
  keyMatches,
  leagueContext,
  appUrl = baseUrl,
}) => {
  const getUrgencyColor = () => {
    return deadline.isUrgent ? '#ef4444' : '#f59e0b';
  };

  const getUrgencyIcon = () => {
    return deadline.isUrgent ? '🚨' : '⏰';
  };

  const getFormIcon = (form: 'improving' | 'declining' | 'steady') => {
    switch (form) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      case 'steady': return '➡️';
      default: return '📊';
    }
  };

  const getPositionSuffix = (position: number) => {
    const j = position % 10;
    const k = position % 100;
    if (j == 1 && k != 11) return "st";
    if (j == 2 && k != 12) return "nd";
    if (j == 3 && k != 13) return "rd";
    return "th";
  };

  return (
    <Html>
      <Head />
      <Preview>
        {deadline.isUrgent ? '🚨 Last Chance!' : '⏰ Prediction Deadline Approaching'} Round {String(deadline.roundNumber)} - {deadline.timeRemaining} remaining
      </Preview>
      <Body style={main}>
        <Container style={container}>
          
          {/* Header with Urgency */}
          <Section style={header}>
            <Heading style={h1}>
              {getUrgencyIcon()} Round {String(deadline.roundNumber)} Predictions
            </Heading>
            <Text style={headerSubtext}>
              {deadline.isUrgent ? 'Final call' : 'Time to make your picks'} - {deadline.timeRemaining} remaining!
            </Text>
          </Section>

          {/* Countdown/Deadline Section */}
          <Section style={section}>
            <div style={{...deadlineCard, borderColor: getUrgencyColor()}}>
              <Heading style={h2}>
                {deadline.isUrgent ? '🚨 DEADLINE ALERT' : '⏰ Deadline Reminder'}
              </Heading>
              <Text style={{...deadlineText, color: getUrgencyColor()}}>
                <strong>{deadline.timeRemaining}</strong> remaining to submit your predictions
              </Text>
              <Text style={deadlineSubtext}>
                Deadline: {new Date(deadline.deadline).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </div>
          </Section>

          {/* AI-Generated Personal Message */}
          <Section style={section}>
            <Heading style={h2}>💡 Your Personal Insight</Heading>
            <div style={aiContentCard}>
              <Text style={aiMessage}>{aiContent.personalMessage}</Text>
              {aiContent.strategyTip && (
                <Text style={aiTip}>
                  💡 <strong>Strategy Tip:</strong> {aiContent.strategyTip}
                </Text>
              )}
              {aiContent.fixtureInsight && (
                <Text style={aiInsight}>
                  ⚽ <strong>Match Insight:</strong> {aiContent.fixtureInsight}
                </Text>
              )}
            </div>
          </Section>

          {/* Current Position & Form */}
          <Section style={section}>
            <Heading style={h2}>📊 Your League Status</Heading>
            <div style={positionCard}>
              <Row>
                <Column style={positionColumn}>
                  <Text style={positionStat}>
                    <strong style={{ fontSize: '32px', color: '#1f2937' }}>
                      {user.currentPosition}{getPositionSuffix(user.currentPosition)}
                    </strong><br/>
                    <span style={positionLabel}>out of {user.totalPlayers} players</span>
                  </Text>
                </Column>
                <Column style={positionColumn}>
                  <Text style={positionStat}>
                    <strong style={{ fontSize: '24px', color: '#dc2626' }}>-{user.pointsBehindLeader}</strong><br/>
                    <span style={positionLabel}>points behind leader</span>
                  </Text>
                </Column>
              </Row>
              <Text style={formIndicator}>
                {getFormIcon(user.recentForm)} Recent form: <strong>{user.recentForm}</strong>
                {user.pointsAheadOfNext && (
                  <span style={formDetails}> • {user.pointsAheadOfNext} pts ahead of next player</span>
                )}
              </Text>
            </div>
          </Section>

          {/* Key Matches to Watch */}
          {keyMatches && keyMatches.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>🔥 Key Matches This Round</Heading>
              <div style={keyMatchesContainer}>
                {keyMatches.map((match) => (
                  <div key={match.id} style={keyMatchCard}>
                    <Text style={keyMatchLabel}>⭐ {match.importance?.toUpperCase()} IMPORTANCE</Text>
                    <div style={matchTeams}>
                      <div style={teamContainer}>
                        <Text style={teamName}>{match.homeTeam.name}</Text>
                        {match.homeTeam.form && (
                          <Text style={teamForm}>Form: {match.homeTeam.form}</Text>
                        )}
                      </div>
                      <Text style={matchVs}>VS</Text>
                      <div style={teamContainer}>
                        <Text style={teamName}>{match.awayTeam.name}</Text>
                        {match.awayTeam.form && (
                          <Text style={teamForm}>Form: {match.awayTeam.form}</Text>
                        )}
                      </div>
                    </div>
                    <Text style={matchTime}>
                      🕒 {new Date(match.kickoffTime).toLocaleDateString('en-US', {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {match.venue && ` • ${match.venue}`}
                    </Text>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* All Upcoming Fixtures */}
          <Section style={section}>
            <Heading style={h2}>📅 All Round {String(deadline.roundNumber)} Fixtures</Heading>
            <div style={fixturesGrid}>
              {fixtures.map((fixture) => (
                <div key={fixture.id} style={fixtureCard}>
                  <div style={fixtureTeams}>
                    <Text style={fixtureTeam}>{fixture.homeTeam.name}</Text>
                    <Text style={fixtureVs}>vs</Text>
                    <Text style={fixtureTeam}>{fixture.awayTeam.name}</Text>
                  </div>
                  <Text style={fixtureTime}>
                    {new Date(fixture.kickoffTime).toLocaleDateString('en-US', {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </div>
              ))}
            </div>
          </Section>

          {/* League Context */}
          {leagueContext && (
            <Section style={section}>
              <Heading style={h2}>🎯 How You&apos;re Doing</Heading>
              <div style={contextCard}>
                <Row>
                  <Column style={contextColumn}>
                    <Text style={contextStat}>
                      <strong style={{ fontSize: '20px', color: '#059669' }}>{leagueContext.yourLastRoundScore}</strong><br/>
                      <span style={contextLabel}>Your last round</span>
                    </Text>
                  </Column>
                  <Column style={contextColumn}>
                    <Text style={contextStat}>
                      <strong style={{ fontSize: '20px', color: '#6b7280' }}>{leagueContext.averageScore}</strong><br/>
                      <span style={contextLabel}>League average</span>
                    </Text>
                  </Column>
                  <Column style={contextColumn}>
                    <Text style={contextStat}>
                      <strong style={{ fontSize: '20px', color: '#dc2626' }}>{leagueContext.topScore}</strong><br/>
                      <span style={contextLabel}>Round high score</span>
                    </Text>
                  </Column>
                </Row>
              </div>
            </Section>
          )}

          {/* AI Motivation & CTA */}
          <Section style={section}>
            <div style={ctaContainer}>
              <Text style={motivationText}>{aiContent.encouragement}</Text>
              <Button 
                style={{...button, backgroundColor: deadline.isUrgent ? '#ef4444' : '#059669'}} 
                href={`${appUrl}?utm_source=email&utm_medium=reminder&utm_campaign=round_${String(deadline.roundNumber)}`}
              >
                {deadline.isUrgent ? '🚨 Submit Now - Time Running Out!' : '⚽ Make Your Predictions'}
              </Button>
              <Text style={ctaSubtext}>
                Don&apos;t miss out on round {String(deadline.roundNumber)}! Every point counts towards your league position.
              </Text>
            </div>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
            <Text style={footerText}>
              Good luck with your predictions, {user.name}!
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
  fontSize: '28px',
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
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
};

const deadlineCard = {
  backgroundColor: '#fef2f2',
  border: '2px solid',
  borderRadius: '8px',
  padding: '24px',
  textAlign: 'center' as const,
};

const deadlineText = {
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
};

const deadlineSubtext = {
  fontSize: '16px',
  color: '#6b7280',
  margin: '0',
  textAlign: 'center' as const,
};

const aiContentCard = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #0ea5e9',
  borderRadius: '8px',
  padding: '20px',
};

const aiMessage = {
  fontSize: '18px',
  color: '#1f2937',
  margin: '0 0 16px 0',
  lineHeight: '1.6',
  fontStyle: 'italic',
};

const aiTip = {
  backgroundColor: '#fef3c7',
  border: '1px solid #f59e0b',
  borderRadius: '6px',
  padding: '12px',
  margin: '0 0 12px 0',
  fontSize: '15px',
  color: '#92400e',
};

const aiInsight = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #10b981',
  borderRadius: '6px',
  padding: '12px',
  margin: '0',
  fontSize: '15px',
  color: '#065f46',
};

const positionCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
};

const positionColumn = {
  width: '50%',
  textAlign: 'center' as const,
};

const positionStat = {
  textAlign: 'center' as const,
  margin: '0 0 16px 0',
};

const positionLabel = {
  color: '#6b7280',
  fontSize: '14px',
};

const formIndicator = {
  fontSize: '16px',
  color: '#374151',
  textAlign: 'center' as const,
  margin: '16px 0 0 0',
  paddingTop: '16px',
  borderTop: '1px solid #e5e7eb',
};

const formDetails = {
  color: '#6b7280',
  fontSize: '14px',
};

const keyMatchesContainer = {
  display: 'grid',
  gap: '16px',
};

const keyMatchCard = {
  backgroundColor: '#fff7ed',
  border: '2px solid #f97316',
  borderRadius: '8px',
  padding: '16px',
};

const keyMatchLabel = {
  backgroundColor: '#f97316',
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 'bold',
  padding: '4px 8px',
  borderRadius: '4px',
  textAlign: 'center' as const,
  margin: '0 0 12px 0',
  display: 'inline-block',
};

const matchTeams = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '12px 0',
};

const teamContainer = {
  flex: '1',
  textAlign: 'center' as const,
};

const teamName = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 4px 0',
};

const teamForm = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0',
};

const matchVs = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#f97316',
  margin: '0 16px',
};

const matchTime = {
  fontSize: '14px',
  color: '#6b7280',
  textAlign: 'center' as const,
  margin: '8px 0 0 0',
};

const fixturesGrid = {
  display: 'grid',
  gap: '12px',
};

const fixtureCard = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '12px',
};

const fixtureTeams = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '0 0 8px 0',
};

const fixtureTeam = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#1f2937',
  margin: '0',
  flex: '1',
};

const fixtureVs = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 8px',
  fontWeight: 'bold',
};

const fixtureTime = {
  fontSize: '12px',
  color: '#6b7280',
  textAlign: 'center' as const,
  margin: '0',
};

const contextCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
};

const contextColumn = {
  width: '33.33%',
  textAlign: 'center' as const,
};

const contextStat = {
  textAlign: 'center' as const,
  margin: '0',
};

const contextLabel = {
  color: '#6b7280',
  fontSize: '14px',
};

const ctaContainer = {
  textAlign: 'center' as const,
  padding: '32px 24px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
};

const motivationText = {
  fontSize: '18px',
  color: '#1f2937',
  margin: '0 0 24px 0',
  lineHeight: '1.6',
  fontWeight: '500',
};

const button = {
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '18px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
};

const ctaSubtext = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
  lineHeight: '1.5',
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

export default ReminderEmail; 