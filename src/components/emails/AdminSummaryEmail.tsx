import React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';

export interface UserRoundScore {
  userId: string;
  userName: string;
  matchPoints: number;
  dynamicPoints?: number;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
}

export interface AdminSummaryEmailProps {
  roundName: string;
  roundId: number;
  totalParticipants: number;
  averagePoints: number;
  userScores: UserRoundScore[];
  topScorers: UserRoundScore[];
  completedAt: string;
}

export default function AdminSummaryEmail({
  roundName,
  roundId,
  totalParticipants,
  averagePoints,
  userScores,
  topScorers,
  completedAt,
}: AdminSummaryEmailProps) {
  const previewText = `${roundName} Admin Summary - ${totalParticipants} participants, ${averagePoints.toFixed(1)} avg points`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>📊 {roundName} Complete - Admin Summary</Heading>
            <Text style={subtitle}>Round #{roundId} • Completed {new Date(completedAt).toLocaleString()}</Text>
          </Section>

          {/* Top Performers Section */}
          <Section style={section}>
            <Heading style={h2}>🏆 Top Performers</Heading>
            {topScorers.map((scorer, index) => (
              <Row key={scorer.userId} style={topScorerRow}>
                <Column style={rankColumn}>
                  <Text style={rank}>{index + 1}.</Text>
                </Column>
                <Column style={nameColumn}>
                  <Text style={topScorerName}>{scorer.userName}</Text>
                </Column>
                <Column style={pointsColumn}>
                  <Text style={topScorerPoints}>
                    {scorer.totalPoints} pts
                    <span style={pointsBreakdown}>
                      ({scorer.matchPoints} match{scorer.dynamicPoints ? ` + ${scorer.dynamicPoints} dynamic` : ''})
                    </span>
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          {/* Round Statistics */}
          <Section style={section}>
            <Heading style={h2}>📈 Round Statistics</Heading>
            <Row style={statRow}>
              <Column style={statLabel}>Total Participants:</Column>
              <Column style={statValue}>{totalParticipants}</Column>
            </Row>
            <Row style={statRow}>
              <Column style={statLabel}>Average Points:</Column>
              <Column style={statValue}>{averagePoints.toFixed(1)}</Column>
            </Row>
            <Row style={statRow}>
              <Column style={statLabel}>Highest Score:</Column>
              <Column style={statValue}>{topScorers[0]?.totalPoints || 0}</Column>
            </Row>
          </Section>

          {/* All Participants Table */}
          <Section style={section}>
            <Heading style={h2}>📋 All Participants</Heading>
            <table style={table}>
              <thead>
                <tr>
                  <th style={tableHeader}>Name</th>
                  <th style={tableHeader}>Match Points</th>
                  <th style={tableHeader}>Correct/Total</th>
                  <th style={tableHeader}>Total Points</th>
                </tr>
              </thead>
              <tbody>
                {userScores.map((user) => (
                  <tr key={user.userId}>
                    <td style={tableCell}>{user.userName}</td>
                    <td style={tableCellCenter}>{user.matchPoints}</td>
                    <td style={tableCellCenter}>{user.correctPredictions}/{user.totalPredictions}</td>
                    <td style={tableCellBold}>{user.totalPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This admin summary was automatically generated when the round completed scoring.
            </Text>
            <Text style={footerText}>
              🤖 APL League Coupon Admin System
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '0 48px',
  marginBottom: '32px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '16px 0',
  padding: '0',
};

const h2 = {
  color: '#333',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '16px 0 8px',
  padding: '0',
};

const subtitle = {
  color: '#666',
  fontSize: '14px',
  margin: '0',
};

const section = {
  padding: '0 48px',
  marginBottom: '32px',
};

const topScorerRow = {
  marginBottom: '12px',
  paddingBottom: '12px',
  borderBottom: '1px solid #eee',
};

const rankColumn = {
  width: '40px',
  verticalAlign: 'middle',
};

const nameColumn = {
  verticalAlign: 'middle',
};

const pointsColumn = {
  textAlign: 'right' as const,
  verticalAlign: 'middle',
};

const rank = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0',
};

const topScorerName = {
  fontSize: '16px',
  color: '#333',
  margin: '0',
};

const topScorerPoints = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#333',
  margin: '0',
};

const pointsBreakdown = {
  fontSize: '14px',
  fontWeight: 'normal',
  color: '#666',
  marginLeft: '4px',
};

const statRow = {
  marginBottom: '8px',
};

const statLabel = {
  fontSize: '14px',
  color: '#666',
  width: '50%',
};

const statValue = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#333',
  textAlign: 'right' as const,
};

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginTop: '16px',
};

const tableHeader = {
  fontSize: '14px',
  fontWeight: 'bold',
  padding: '8px 4px',
  borderBottom: '2px solid #333',
  textAlign: 'left' as const,
};

const tableCell = {
  fontSize: '14px',
  padding: '8px 4px',
  borderBottom: '1px solid #eee',
};

const tableCellCenter = {
  ...tableCell,
  textAlign: 'center' as const,
};

const tableCellBold = {
  ...tableCell,
  fontWeight: 'bold',
  textAlign: 'center' as const,
};

const footer = {
  padding: '0 48px',
  marginTop: '32px',
};

const footerText = {
  color: '#999',
  fontSize: '12px',
  margin: '4px 0',
};