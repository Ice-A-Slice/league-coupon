'use client';

import React, { useState, useEffect } from 'react';
import { type SimpleReminderEmailProps } from '@/components/emails/SimpleReminderEmail';
import { Button } from '@/components/ui/button';

// Sample data for Simple Reminder Email
const sampleSimpleReminderData: SimpleReminderEmailProps = {
  roundName: "Round 6",
  submittedUsers: [
    "Johann Johannsson",
    "Sævar Freyr Alexandersson", 
    "Divya",
    "Jóhannes Arelakis",
    "Tommi Sigurbjorns",
    "Kristjan",
    "Arni Hardarson",
    "Robert Wessman",
    "Stefan Möller",
    "Aron Ingi Kristinsson",
    "Baldur Jonsson",
    "Snorri Páll Sigurðsson"
  ],
  gameLeaderInitials: "PC",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
};

export default function EmailPreviewPage() {
  const [emailType, setEmailType] = useState<'summary' | 'reminder' | 'simple-reminder'>('simple-reminder');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const generateHtmlPreview = async () => {
    try {
      const response = await fetch('/api/email-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_type: emailType === 'simple-reminder' ? 'simple-reminder' : 'simple-reminder'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.preview) {
          // Open HTML preview in new tab
          const newWindow = window.open();
          if (newWindow) {
            newWindow.document.write(result.preview);
            newWindow.document.close();
          }
        } else {
          alert('Failed to generate preview: ' + (result.error || 'Unknown error'));
        }
      } else {
        const errorText = await response.text();
        alert('API error ' + response.status + ': ' + errorText);
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      alert('Error generating preview. Check console for details.');
    }
  };

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
              Reminder Email (Old)
            </Button>
            <Button
              onClick={() => setEmailType('simple-reminder')}
              variant={emailType === 'simple-reminder' ? 'default' : 'outline'}
            >
              Simple Reminder Email
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Preview: {emailType === 'summary' ? 'Round Summary' : emailType === 'reminder' ? 'Round Reminder (Old)' : 'Simple Reminder'} Email
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              This preview shows how the email will look when sent to users
            </p>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="p-4 bg-yellow-50 border-b">
              <p className="text-sm text-yellow-800">
                ⚠️ Email components are optimized for email clients. For best preview, use the &quot;Generate HTML Preview&quot; button below.
              </p>
            </div>
            <div className="p-8">
              {emailType === 'simple-reminder' ? (
                <div className="space-y-4 font-sans">
                  <div className="text-lg font-medium">Subject: APL - {sampleSimpleReminderData.roundName} - Friendly Reminder</div>
                  <hr />
                  <p>Dear friends,</p>
                  <p>This is a friendly reminder to submit your bets for {sampleSimpleReminderData.roundName} that starts tomorrow.</p>
                  <p>So far we&apos;ve received the bets from:</p>
                  <ul className="list-none ml-4 space-y-1">
                    {sampleSimpleReminderData.submittedUsers.map((user, index) => (
                      <li key={index}>{user}</li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    Best regards,<br />
                    {sampleSimpleReminderData.gameLeaderInitials}
                  </p>
                  <div className="mt-6 pt-4 border-t text-center">
                    <a href={sampleSimpleReminderData.appUrl} className="text-blue-600 underline">
                      Submit your bets here
                    </a>
                  </div>
                </div>
              ) : emailType === 'summary' ? (
                <div className="p-4 bg-gray-100 rounded">
                  <p>Summary email preview - use HTML preview for full view</p>
                </div>
              ) : (
                <div className="p-4 bg-gray-100 rounded">
                  <p>Old reminder email preview - use HTML preview for full view</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4">
            <Button
              onClick={() => generateHtmlPreview()}
              className="w-full"
              variant="outline"
            >
              📧 Generate Full HTML Preview
            </Button>
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