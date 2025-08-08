import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { SimpleReminderEmail } from '@/components/emails/SimpleReminderEmail';
import { TransparencyEmail } from '@/components/emails/TransparencyEmail';
import type { TransparencyEmailData } from '@/lib/userDataAggregationService';

/**
 * Public email preview endpoint for development
 * This endpoint doesn't require authentication and generates preview emails with sample data
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development or test environments
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Preview endpoint not available in production' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const emailType = body.email_type || 'simple-reminder';

    if (emailType === 'simple-reminder') {
      // Sample data for simple reminder email
      const sampleProps = {
        roundName: 'Round 6',
        submittedUsers: [
          'Johann Johannsson',
          'Sævar Freyr Alexandersson', 
          'Divya',
          'Jóhannes Arelakis',
          'Tommi Sigurbjorns',
          'Kristjan',
          'Arni Hardarson',
          'Robert Wessman',
          'Stefan Möller',
          'Aron Ingi Kristinsson',
          'Baldur Jonsson',
          'Snorri Páll Sigurðsson'
        ],
        gameLeaderInitials: 'PC',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      };

      // Render the email HTML safely
      let htmlContent;
      try {
        const { render } = await import('@react-email/render');
        htmlContent = await render(React.createElement(SimpleReminderEmail, sampleProps));
      } catch (renderError) {
        console.error('Email rendering error:', renderError);
        // Fallback: create simple HTML structure
        htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>APL - ${sampleProps.roundName} - Friendly Reminder</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Dear friends,</p>
  <p>This is a friendly reminder to submit your bets for ${sampleProps.roundName} that starts tomorrow.</p>
  <p>So far we've received the bets from:</p>
  <ul style="list-style: none; padding-left: 0;">
    ${sampleProps.submittedUsers.map(user => `<li style="margin-bottom: 4px;">${user}</li>`).join('')}
  </ul>
  <p style="margin-top: 20px;">
    Best regards,<br>
    ${sampleProps.gameLeaderInitials}
  </p>
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center;">
    <a href="${sampleProps.appUrl}" style="color: #007cba; text-decoration: underline;">
      Submit your bets here
    </a>
  </div>
</body>
</html>`;
      }

      return NextResponse.json({
        success: true,
        preview: htmlContent,
        email_type: 'simple-reminder',
        sample_data: sampleProps
      });
    } else if (emailType === 'transparency') {
      // Sample data for transparency email with 20 users and 10 games
      const games = [
        { homeTeam: 'Man United', awayTeam: 'Liverpool' },
        { homeTeam: 'Chelsea', awayTeam: 'Arsenal' },
        { homeTeam: 'Man City', awayTeam: 'Tottenham' },
        { homeTeam: 'Newcastle', awayTeam: 'Brighton' },
        { homeTeam: 'Aston Villa', awayTeam: 'West Ham' },
        { homeTeam: 'Brentford', awayTeam: 'Fulham' },
        { homeTeam: 'Crystal Palace', awayTeam: 'Everton' },
        { homeTeam: 'Leicester', awayTeam: 'Wolves' },
        { homeTeam: 'Nottingham Forest', awayTeam: 'Sheffield Utd' },
        { homeTeam: 'Burnley', awayTeam: 'Luton Town' }
      ];

      const userNames = [
        'Johann Johannsson', 'Sævar Freyr Alexandersson', 'Divya', 'Jóhannes Arelakis',
        'Tommi Sigurbjorns', 'Kristjan', 'Arni Hardarson', 'Robert Wessman',
        'Stefan Möller', 'Aron Ingi Kristinsson', 'Baldur Jonsson', 'Snorri Páll Sigurðsson',
        'Erik Andersen', 'Magnus Olafsson', 'Ragnar Eriksson', 'Lars Nielsen',
        'Björn Andersson', 'Sven Johansson', 'Nils Petersen', 'Anders Larsson'
      ];

      const predictions = ['home', 'draw', 'away', null] as const;
      
      const users = userNames.map((name, index) => ({
        userId: (index + 1).toString(),
        userName: name,
        predictions: games.map(game => ({
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          prediction: predictions[Math.floor(Math.random() * predictions.length)]
        }))
      }));

      const sampleTransparencyData: TransparencyEmailData = {
        roundId: 6,
        roundName: 'Round 6',
        users,
        games
      };

      // Render the transparency email HTML
      let htmlContent;
      try {
        const { render } = await import('@react-email/render');
        htmlContent = await render(React.createElement(TransparencyEmail, { data: sampleTransparencyData }));
      } catch (renderError) {
        console.error('Email rendering error:', renderError);
        return NextResponse.json(
          { success: false, error: 'Failed to render transparency email' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        preview: htmlContent,
        email_type: 'transparency',
        sample_data: sampleTransparencyData
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Email type not supported in preview' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Email preview error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate email preview' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email preview endpoint - use POST with email_type parameter',
    supported_types: ['simple-reminder', 'transparency'],
    example: {
      method: 'POST',
      body: { email_type: 'simple-reminder' }
    }
  });
}