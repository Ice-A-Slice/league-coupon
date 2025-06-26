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
  Hr,
} from '@react-email/components';
import * as React from 'react';
import type { TransparencyEmailData } from '@/lib/userDataAggregationService';

export interface TransparencyEmailProps {
  data: TransparencyEmailData;
  appUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const TransparencyEmail: React.FC<TransparencyEmailProps> = ({
  data,
  appUrl: _appUrl = baseUrl,
}) => {
  const { roundName, users, games } = data;

  const getPredictionSymbol = (prediction: 'home' | 'draw' | 'away' | null) => {
    switch (prediction) {
      case 'home': return '1';
      case 'draw': return 'X';
      case 'away': return '2';
      case null: return '-';
      default: return '-';
    }
  };

  const getPredictionColor = (prediction: 'home' | 'draw' | 'away' | null) => {
    switch (prediction) {
      case 'home': return '#3b82f6'; // blue
      case 'draw': return '#f59e0b'; // amber  
      case 'away': return '#ef4444'; // red
      case null: return '#9ca3af'; // gray
      default: return '#9ca3af';
    }
  };

  return (
    <Html>
      <Head />
      <Preview>
        {roundName} has started! Here are everyone&apos;s locked-in predictions.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>🔒 {roundName} - Predictions Locked!</Heading>
            <Text style={headerSubtext}>
              The first game has kicked off. Here are everyone&apos;s locked-in predictions for transparency.
            </Text>
          </Section>

          {/* Introduction */}
          <Section style={section}>
            <Text style={introText}>
              No one can change their predictions now! Below you can see exactly what everyone predicted 
              for this round, ensuring complete fairness and transparency in our league.
            </Text>
          </Section>

          {/* Predictions Table */}
          <Section style={section}>
            <Heading style={h2}>📋 Everyone&apos;s Predictions</Heading>
            
            {/* Table Header */}
            <div style={tableContainer}>
              <div style={tableHeader}>
                <div style={playerColumn}>Player</div>
                {games.map((game, index) => (
                  <div key={index} style={gameColumn}>
                    <Text style={gameHeaderText}>
                      {game.homeTeam} vs {game.awayTeam}
                    </Text>
                  </div>
                ))}
              </div>

              {/* Table Rows */}
              {users.map((user, userIndex) => (
                <div key={user.userId} style={{
                  ...tableRow,
                  backgroundColor: userIndex % 2 === 0 ? '#f9fafb' : '#ffffff'
                }}>
                  <div style={playerColumn}>
                    <Text style={playerNameText}>
                      {user.userName || `Player ${userIndex + 1}`}
                    </Text>
                  </div>
                  {games.map((game, gameIndex) => {
                    const prediction = user.predictions.find(
                      p => p.homeTeam === game.homeTeam && p.awayTeam === game.awayTeam
                    );
                    return (
                      <div key={gameIndex} style={gameColumn}>
                        <Text style={{
                          ...predictionText,
                          color: getPredictionColor(prediction?.prediction || null)
                        }}>
                          {getPredictionSymbol(prediction?.prediction || null)}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Section>

          {/* Legend */}
          <Section style={section}>
            <Heading style={h3}>Legend</Heading>
            <Row>
              <Column>
                <Text style={legendItem}>
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>1</span> = Home Win
                </Text>
              </Column>
              <Column>
                <Text style={legendItem}>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>X</span> = Draw
                </Text>
              </Column>
              <Column>
                <Text style={legendItem}>
                  <span style={{ color: '#ef4444', fontWeight: 'bold' }}>2</span> = Away Win
                </Text>
              </Column>
              <Column>
                <Text style={legendItem}>
                  <span style={{ color: '#9ca3af', fontWeight: 'bold' }}>-</span> = No Prediction
                </Text>
              </Column>
            </Row>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Good luck to everyone! May the best predictor win! 🏆
            </Text>
            <Text style={footerSubtext}>
              TippSlottet - Fair Play, Transparent Predictions
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

// Styles (matching the existing email components)
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
  backgroundColor: '#1f2937',
  padding: '32px 24px',
  borderRadius: '8px 8px 0 0',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
  lineHeight: '1.3',
};

const headerSubtext = {
  color: '#d1d5db',
  fontSize: '16px',
  margin: '0',
  lineHeight: '1.4',
};

const section = {
  padding: '24px',
};

const h2 = {
  color: '#1f2937',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
};

const h3 = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const introText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0',
};

const tableContainer = {
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden',
};

const tableHeader = {
  display: 'flex',
  backgroundColor: '#f3f4f6',
  borderBottom: '2px solid #e5e7eb',
  fontWeight: 'bold',
};

const tableRow = {
  display: 'flex',
  borderBottom: '1px solid #e5e7eb',
  minHeight: '48px',
  alignItems: 'center',
};

const playerColumn = {
  flex: '0 0 120px',
  padding: '12px 16px',
  borderRight: '1px solid #e5e7eb',
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1f2937',
};

const gameColumn = {
  flex: '1',
  padding: '12px 8px',
  textAlign: 'center' as const,
  borderRight: '1px solid #e5e7eb',
  minWidth: '80px',
};

const gameHeaderText = {
  fontSize: '12px',
  color: '#374151',
  fontWeight: 'bold',
  margin: '0',
  lineHeight: '1.3',
};

const playerNameText = {
  fontSize: '14px',
  color: '#1f2937',
  margin: '0',
  fontWeight: 'bold',
};

const predictionText = {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
};

const legendItem = {
  fontSize: '14px',
  color: '#374151',
  margin: '0 0 4px 0',
};

const divider = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

const footer = {
  textAlign: 'center' as const,
  padding: '24px',
};

const footerText = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const footerSubtext = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '0',
}; 