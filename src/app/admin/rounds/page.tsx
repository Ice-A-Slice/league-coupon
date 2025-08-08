'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface BettingRound {
  id: string
  round_number: number
  start_date: string
  end_date: string
  is_active: boolean
  scoring_completed: boolean
  cup_activated_at: string | null
  is_bonus_round: boolean | null
}

interface Season {
  id: string
  competition_id: number
  api_season_year: number
  name?: string
  start_date: string
  end_date: string
  is_current: boolean
  questionnaire_visible?: boolean
  bonus_mode_active?: boolean
}

export default function RoundsManagement() {
  const [rounds, setRounds] = useState<BettingRound[]>([])
  const [_seasons, setSeasons] = useState<Season[]>([])
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null)
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

      // Fetch seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .order('api_season_year', { ascending: false })

      if (seasonsError) throw seasonsError
      setSeasons(seasonsData || [])

      const current = seasonsData?.find(s => s.is_current)
      // Set default values if not set
      if (current) {
        if (current.questionnaire_visible === undefined) {
          current.questionnaire_visible = true
        }
        if (current.bonus_mode_active === undefined) {
          current.bonus_mode_active = false
        }
      }
      setCurrentSeason(current || null)

      // Fetch rounds for current season
      if (current) {
        const { data: roundsData, error: roundsError } = await supabase
          .from('betting_rounds')
          .select('*')
          .eq('competition_id', current.competition_id)
          .order('id', { ascending: true })

        if (roundsError) throw roundsError
        setRounds(roundsData || [])
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const toggleBonusRound = async (roundId: string, currentStatus: boolean | null) => {
    try {
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_bonus_round: !currentStatus })
      })

      if (!response.ok) throw new Error('Failed to update')

      setSuccessMessage('Bonus round status updated successfully')
      await fetchData()
    } catch (err) {
      console.error('Error toggling bonus round:', err)
      setError('Failed to update bonus round status')
    }
  }

  const activateCup = async (roundId: string) => {
    try {
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cup_activated_at: new Date().toISOString() })
      })

      if (!response.ok) throw new Error('Failed to update')

      setSuccessMessage('Cup activated successfully')
      await fetchData()
    } catch (err) {
      console.error('Error activating cup:', err)
      setError('Failed to activate cup')
    }
  }

  const deactivateCup = async (roundId: string) => {
    try {
      setError(null)
      setSuccessMessage(null)

      const response = await fetch(`/api/admin/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cup_activated_at: null })
      })

      if (!response.ok) throw new Error('Failed to update')

      setSuccessMessage('Cup deactivated successfully')
      await fetchData()
    } catch (err) {
      console.error('Error deactivating cup:', err)
      setError('Failed to deactivate cup')
    }
  }

  const toggleQuestionnaireVisibility = async () => {
    if (!currentSeason) return

    try {
      setError(null)
      setSuccessMessage(null)

      const newVisibility = !currentSeason.questionnaire_visible
      
      const { error: updateError } = await supabase
        .from('seasons')
        .update({ questionnaire_visible: newVisibility })
        .eq('id', currentSeason.id)

      if (updateError) throw updateError

      setSuccessMessage(`Questionnaire ${newVisibility ? 'shown' : 'hidden'} successfully`)
      await fetchData()
    } catch (err) {
      console.error('Error toggling questionnaire visibility:', err)
      setError('Failed to toggle questionnaire visibility')
    }
  }

  const toggleBonusModeActive = async () => {
    if (!currentSeason) return

    try {
      setError(null)
      setSuccessMessage(null)

      const newBonusMode = !currentSeason.bonus_mode_active
      
      const { error: updateError } = await supabase
        .from('seasons')
        .update({ bonus_mode_active: newBonusMode })
        .eq('id', currentSeason.id)

      if (updateError) throw updateError

      setSuccessMessage(`Bonus mode ${newBonusMode ? 'activated' : 'deactivated'} successfully`)
      await fetchData()
    } catch (err) {
      console.error('Error toggling bonus mode:', err)
      setError('Failed to toggle bonus mode')
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
        <h1 className="text-2xl font-bold text-gray-900">Round Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage bonus rounds and cup activation
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

      {currentSeason && (
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Season Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Dynamic Questionnaire</p>
                  <p className="text-sm text-gray-500">Show or hide the season-long prediction questions for all users</p>
                </div>
                <button
                  onClick={toggleQuestionnaireVisibility}
                  className={`${
                    currentSeason.questionnaire_visible 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-gray-400 hover:bg-gray-500'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      currentSeason.questionnaire_visible ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">Bonus Mode</p>
                  <p className="text-sm text-gray-500">When active, all open rounds award 2x points for correct predictions</p>
                </div>
                <button
                  onClick={toggleBonusModeActive}
                  className={`${
                    currentSeason.bonus_mode_active 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-gray-400 hover:bg-gray-500'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      currentSeason.bonus_mode_active ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            {currentSeason ? `${currentSeason.name || `Season ${currentSeason.api_season_year}`} Rounds` : 'No Active Season'}
          </h3>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Round
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bonus Round
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cup Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rounds.map((round) => (
                <tr key={round.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Round {round.round_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(round.start_date).toLocaleDateString()} - {new Date(round.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                      round.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : round.scoring_completed 
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {round.is_active ? 'Active' : round.scoring_completed ? 'Completed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleBonusRound(round.id, round.is_bonus_round)}
                      className={`inline-flex px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        round.is_bonus_round
                          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {round.is_bonus_round ? 'Bonus Active' : 'Regular'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                      round.cup_activated_at
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {round.cup_activated_at ? 'Cup Active' : 'No Cup'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {round.cup_activated_at ? (
                      <button
                        onClick={() => deactivateCup(round.id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Deactivate Cup
                      </button>
                    ) : (
                      <button
                        onClick={() => activateCup(round.id)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Activate Cup
                      </button>
                    )}
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
              <strong>Tips:</strong> Bonus Mode applies 2x points to all open rounds when activated globally. Individual bonus rounds can be toggled per round. Cup activation enables special cup scoring rules for that round.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}