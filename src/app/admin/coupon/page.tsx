'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UserSeasonAnswer {
  id: string
  user_id: string
  season_id: string
  top_scorer: string | null
  top_team: string | null
  relegated_team1: string | null
  relegated_team2: string | null
  promoted_team1: string | null
  promoted_team2: string | null
  created_at: string
  updated_at: string
}

export default function CouponManagement() {
  const [seasonAnswers, setSeasonAnswers] = useState<UserSeasonAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch season answers
      const { data: seasonData, error: seasonError } = await supabase
        .from('user_season_answers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (seasonError) throw seasonError
      setSeasonAnswers(seasonData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const deleteSeasonAnswer = async (answerId: string) => {
    if (!confirm('Are you sure you want to delete this season answer?')) return

    try {
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/admin/season-answers/${answerId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')

      setSuccessMessage('Season answer deleted successfully')
      await fetchData()
    } catch (err) {
      console.error('Error deleting season answer:', err)
      setError('Failed to delete season answer')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coupon Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage dynamic questions and season questionnaire answers
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Season Questionnaire Answers
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Scorer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Relegated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Promoted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {seasonAnswers.map((answer) => (
                <tr key={answer.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {answer.user_id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {answer.top_scorer || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {answer.top_team || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {[answer.relegated_team1, answer.relegated_team2].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {[answer.promoted_team1, answer.promoted_team2].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => deleteSeasonAnswer(answer.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Season Questionnaire:</strong> Manage user submissions for season-long predictions like top scorer, relegated teams, etc. 
              Delete entries if users have submitted invalid or duplicate answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}