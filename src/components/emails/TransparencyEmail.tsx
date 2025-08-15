import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
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
        Here follows the bets for the APL {roundName}.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          
          {/* Simple greeting */}
          <Section style={section}>
            <Text style={greetingText}>
              Dear friends,
            </Text>
            <Text style={mainText}>
              Here follows the bets for the APL {roundName}.
            </Text>
          </Section>

          {/* Predictions Table */}
          <Section style={section}>
            
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

          {/* Closing */}
          <Section style={section}>
            <Text style={mainText}>
              Good luck.
            </Text>
            <Text style={signatureText}>
              Best regards,<br />
              PC
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

const section = {
  padding: '24px',
};

const greetingText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px 0',
};

const mainText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 24px 0',
};

const signatureText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '24px 0 0 0',
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