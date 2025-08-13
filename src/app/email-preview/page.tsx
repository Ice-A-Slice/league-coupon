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
  const [emailType, setEmailType] = useState<'summary' | 'reminder' | 'simple-reminder' | 'transparency' | 'admin-summary'>('simple-reminder');
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
          email_type: emailType === 'admin-summary' ? 'admin-summary' : emailType === 'transparency' ? 'transparency' : emailType === 'summary' ? 'summary' : 'simple-reminder'
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
            <Button
              onClick={() => setEmailType('transparency')}
              variant={emailType === 'transparency' ? 'default' : 'outline'}
            >
              Transparency Email
            </Button>
            <Button
              onClick={() => setEmailType('admin-summary')}
              variant={emailType === 'admin-summary' ? 'default' : 'outline'}
            >
              Admin Summary Email
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Preview: {emailType === 'admin-summary' ? 'Admin Summary' : emailType === 'summary' ? 'Round Summary' : emailType === 'reminder' ? 'Round Reminder (Old)' : emailType === 'transparency' ? 'Transparency' : 'Simple Reminder'} Email
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
              ) : emailType === 'transparency' ? (
                <div className="space-y-4 font-sans">
                  <div className="text-lg font-medium">Subject: 🔒 Round 6 - Predictions Locked!</div>
                  <hr />
                  <p>The first game has kicked off. Here are everyone&apos;s locked-in predictions for transparency.</p>
                  <p>No one can change their predictions now! Below you can see exactly what everyone predicted for this round.</p>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 p-2 font-bold text-sm border-b">
                      <div className="flex">
                        <div className="w-32">Player</div>
                        <div className="flex-1 text-center">Man U vs Liverpool</div>
                        <div className="flex-1 text-center">Chelsea vs Arsenal</div>
                        <div className="flex-1 text-center">City vs Spurs</div>
                        <div className="flex-1 text-center">Newcastle vs Brighton</div>
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="flex p-2 bg-gray-50">
                        <div className="w-32 font-medium">Johann</div>
                        <div className="flex-1 text-center text-blue-600 font-bold">1</div>
                        <div className="flex-1 text-center text-amber-600 font-bold">X</div>
                        <div className="flex-1 text-center text-red-600 font-bold">2</div>
                        <div className="flex-1 text-center text-gray-400 font-bold">-</div>
                      </div>
                      <div className="flex p-2">
                        <div className="w-32 font-medium">Sævar Freyr</div>
                        <div className="flex-1 text-center text-red-600 font-bold">2</div>
                        <div className="flex-1 text-center text-blue-600 font-bold">1</div>
                        <div className="flex-1 text-center text-blue-600 font-bold">1</div>
                        <div className="flex-1 text-center text-amber-600 font-bold">X</div>
                      </div>
                      <div className="flex p-2 bg-gray-50">
                        <div className="w-32 font-medium">Divya</div>
                        <div className="flex-1 text-center text-amber-600 font-bold">X</div>
                        <div className="flex-1 text-center text-red-600 font-bold">2</div>
                        <div className="flex-1 text-center text-blue-600 font-bold">1</div>
                        <div className="flex-1 text-center text-blue-600 font-bold">1</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-sm space-y-1">
                    <p><span className="text-blue-600 font-bold">1</span> = Home Win | <span className="text-amber-600 font-bold">X</span> = Draw | <span className="text-red-600 font-bold">2</span> = Away Win | <span className="text-gray-400 font-bold">-</span> = No Prediction</p>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t text-center">
                    <p className="font-medium">Good luck to everyone! May the best predictor win! 🏆</p>
                    <p className="text-sm text-gray-600 mt-1">TippSlottet - Fair Play, Transparent Predictions</p>
                  </div>
                </div>
              ) : emailType === 'admin-summary' ? (
                <div className="space-y-4 font-sans">
                  <div className="text-lg font-medium">Subject: 📊 Round 6 - Premier League Admin Summary - 15 participants</div>
                  <hr />
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-lg mb-2">🏆 Top Performers</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between bg-yellow-50 p-2 rounded">
                          <span><strong>1. Arnar Steinn</strong></span>
                          <span><strong>15 pts</strong> (12 match + 3 dynamic)</span>
                        </div>
                        <div className="flex justify-between bg-gray-50 p-2 rounded">
                          <span><strong>2. PierLuigi</strong></span>
                          <span><strong>13 pts</strong> (10 match + 3 dynamic)</span>
                        </div>
                        <div className="flex justify-between bg-gray-50 p-2 rounded">
                          <span><strong>3. Johann Johannsson</strong></span>
                          <span><strong>9 pts</strong> (9 match + 0 dynamic)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg mb-2">📈 Round Statistics</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span>Total Participants:</span>
                          <span className="font-bold">15</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Average Points:</span>
                          <span className="font-bold">7.2</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Highest Score:</span>
                          <span className="font-bold">15</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg mb-2">📋 All Participants (Sample)</h3>
                      <div className="text-sm">
                        <div className="grid grid-cols-4 gap-2 bg-gray-100 p-2 rounded font-bold">
                          <div>Name</div>
                          <div className="text-center">Match Points</div>
                          <div className="text-center">Correct/Total</div>
                          <div className="text-center">Total Points</div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-2 border-b">
                          <div>Arnar Steinn</div>
                          <div className="text-center">12</div>
                          <div className="text-center">8/10</div>
                          <div className="text-center font-bold">15</div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-2 border-b bg-gray-50">
                          <div>PierLuigi</div>
                          <div className="text-center">10</div>
                          <div className="text-center">7/10</div>
                          <div className="text-center font-bold">13</div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-2 border-b">
                          <div>Johann Johannsson</div>
                          <div className="text-center">9</div>
                          <div className="text-center">6/10</div>
                          <div className="text-center font-bold">9</div>
                        </div>
                        <div className="text-center text-gray-500 mt-2 text-xs">... and 12 more participants</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t text-center text-sm text-gray-600">
                    <p>This admin summary was automatically generated when the round completed scoring.</p>
                    <p className="mt-1">🤖 APL League Coupon Admin System</p>
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