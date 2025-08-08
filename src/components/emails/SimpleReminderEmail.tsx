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

export interface SimpleReminderEmailProps {
  roundName: string;
  submittedUsers: string[];
  gameLeaderInitials?: string;
  appUrl?: string;
}

export const SimpleReminderEmail: React.FC<SimpleReminderEmailProps> = ({
  roundName,
  submittedUsers = [],
  gameLeaderInitials = 'PC',
  appUrl,
}) => {
  
  // Format submitted users list
  const formatUsersList = (users: string[]) => {
    if (users.length === 0) return 'No one has submitted yet.';
    if (users.length === 1) return users[0];
    if (users.length === 2) return `${users[0]} and ${users[1]}`;
    
    const lastUser = users[users.length - 1];
    const otherUsers = users.slice(0, -1);
    return `${otherUsers.join(', ')} and ${lastUser}`;
  };

  return (
    <Html>
      <Head />
      <Preview>
        Reminder to submit your bets for {roundName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          
          <Section style={section}>
            <Text style={greeting}>Dear friends,</Text>
            
            <Text style={body}>
              This is a friendly reminder to submit your bets for {roundName} that starts tomorrow.
            </Text>
            
            <Text style={body}>
              So far we&apos;ve received the bets from:
            </Text>
            
            {submittedUsers.length > 0 ? (
              submittedUsers.length <= 15 ? (
                // Show as simple list if not too many users
                <div style={userList}>
                  {submittedUsers.map((user, index) => (
                    <Text key={index} style={userListItem}>{user}</Text>
                  ))}
                </div>
              ) : (
                // Show as paragraph if many users
                <Text style={body}>
                  {formatUsersList(submittedUsers)}
                </Text>
              )
            ) : (
              <Text style={body}>
                No one has submitted yet.
              </Text>
            )}
            
            <Text style={signature}>
              Best regards,<br />
              {gameLeaderInitials}
            </Text>
            
            {appUrl && (
              <Text style={linkText}>
                <a href={appUrl} style={link}>Submit your bets here</a>
              </Text>
            )}
            
          </Section>

        </Container>
      </Body>
    </Html>
  );
};

// Styles - keeping it simple and clean like a regular email
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px',
  maxWidth: '600px',
};

const section = {
  padding: '0',
};

const greeting = {
  fontSize: '16px',
  color: '#333333',
  margin: '0 0 16px 0',
  lineHeight: '1.4',
};

const body = {
  fontSize: '16px',
  color: '#333333',
  margin: '0 0 16px 0',
  lineHeight: '1.4',
};

const userList = {
  margin: '0 0 16px 20px',
};

const userListItem = {
  fontSize: '16px',
  color: '#333333',
  margin: '0 0 4px 0',
  lineHeight: '1.4',
};

const signature = {
  fontSize: '16px',
  color: '#333333',
  margin: '16px 0',
  lineHeight: '1.4',
};

const linkText = {
  fontSize: '14px',
  color: '#666666',
  margin: '24px 0 0 0',
  lineHeight: '1.4',
  textAlign: 'center' as const,
  borderTop: '1px solid #eeeeee',
  paddingTop: '16px',
};

const link = {
  color: '#007cba',
  textDecoration: 'underline',
};

export default SimpleReminderEmail;