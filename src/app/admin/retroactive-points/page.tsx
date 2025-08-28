'use client';

import { useState } from 'react';

interface RetroactiveResult {
  success: boolean;
  operation?: string;
  result?: {
    userId: string;
    roundsProcessed: number;
    totalPointsAwarded: number;
    rounds: Array<{
      roundId: number;
      roundName: string;
      pointsAwarded: number;
      minimumParticipantScore: number;
      participantCount: number;
    }>;
    errors: string[];
  };
  error?: string;
}

export default function RetroactivePointsAdmin() {
  const [userId, setUserId] = useState('');
  const [competitionId, setCompetitionId] = useState('1'); // Default to competition 1
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetroactiveResult | null>(null);
  const [action, setAction] = useState<'preview' | 'apply'>('preview');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/retroactive-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'preview' ? 'preview_competition' : 'apply_competition',
          userId,
          competitionId: parseInt(competitionId),
          dryRun: action === 'preview' ? true : false,
          triggerStandingsRefresh: true
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Retroactive Points</h1>
        <p className="mt-1 text-sm text-gray-600">
          Award historical points to new competitors based on the &quot;lowest score&quot; rule
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                User ID
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter user UUID (e.g., 8a60d160-a654-4027-969d-44c27a1e94f0)"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Get user ID from: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">SELECT id, email FROM auth.users ORDER BY created_at DESC;</code>
              </p>
            </div>

            <div>
              <label htmlFor="competitionId" className="block text-sm font-medium text-gray-700">
                Competition ID
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="competitionId"
                  value={competitionId}
                  onChange={(e) => setCompetitionId(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Usually 1 for Premier League. Ensures points are only awarded for the correct competition.
              </p>
            </div>

            <div>
              <fieldset>
                <legend className="text-sm font-medium text-gray-700">Action</legend>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center">
                    <input
                      id="preview"
                      name="action"
                      type="radio"
                      value="preview"
                      checked={action === 'preview'}
                      onChange={(e) => setAction(e.target.value as 'preview' | 'apply')}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                    />
                    <label htmlFor="preview" className="ml-3 block text-sm font-medium text-gray-700">
                      Preview (Safe - shows what would happen)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="apply"
                      name="action"
                      type="radio"
                      value="apply"
                      checked={action === 'apply'}
                      onChange={(e) => setAction(e.target.value as 'preview' | 'apply')}
                      className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300"
                    />
                    <label htmlFor="apply" className="ml-3 block text-sm font-medium text-red-700">
                      Apply (Actually awards points - USE CAREFULLY)
                    </label>
                  </div>
                </div>
              </fieldset>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  action === 'preview'
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Processing...' : action === 'preview' ? 'Preview Points' : '⚠️ Apply Points'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {result && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Results
            </h3>
            
            {result.success ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-green-800">
                      ✅ {result.operation} Successful
                    </h4>
                    {result.result && (
                      <div className="mt-2 text-sm text-green-700">
                        <div className="space-y-1">
                          <p><strong>User ID:</strong> <code className="text-xs bg-green-100 px-1 py-0.5 rounded">{result.result.userId}</code></p>
                          <p><strong>Rounds Processed:</strong> {result.result.roundsProcessed}</p>
                          <p><strong>Total Points Awarded:</strong> <span className="font-bold text-green-900">{result.result.totalPointsAwarded} points</span></p>
                        </div>
                        
                        {result.result.rounds.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-medium mb-2">Round Details:</h5>
                            <div className="bg-green-100 rounded p-2 space-y-1">
                              {result.result.rounds.map((round) => (
                                <div key={round.roundId} className="text-sm">
                                  <strong>Round {round.roundId}</strong> ({round.roundName}): 
                                  <span className="font-bold text-green-900"> {round.pointsAwarded} points</span>
                                  <span className="text-green-600">
                                    {' '}(minimum score was {round.minimumParticipantScore}, {round.participantCount} participants)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {result.result.errors.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-medium mb-2 text-red-600">Errors:</h5>
                            <ul className="list-disc list-inside text-sm text-red-600">
                              {result.result.errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {action === 'apply' && result.result.totalPointsAwarded > 0 && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm text-blue-700">
                              <strong>Next Steps:</strong> The user&apos;s points have been updated and standings have been refreshed. 
                              They should now see their retroactive points reflected in the leaderboard.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">❌ Error</h4>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{result.error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How it works</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li>New competitors automatically get points equal to the <strong>lowest score</strong> from each round they missed</li>
                <li>Only processes rounds from the specified competition (avoids cross-competition contamination)</li>
                <li>Points appear immediately in standings after applying</li>
                <li><strong>Always preview first</strong> to see exactly what will happen</li>
                <li>Safe to run multiple times - won&apos;t duplicate points</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}