'use client'

import { useState, useEffect } from 'react'

interface WhitelistEntry {
  id: string
  email: string
  added_by: string
  added_at: string
  is_active: boolean
  is_admin: boolean
}

export default function WhitelistManagementPage() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Add single email form
  const [newEmail, setNewEmail] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)
  
  // Bulk add form
  const [bulkEmails, setBulkEmails] = useState('')
  const [addingBulk, setAddingBulk] = useState(false)

  const fetchWhitelist = async () => {
    try {
      const response = await fetch('/api/admin/whitelist')
      if (!response.ok) throw new Error('Failed to fetch whitelist')
      const result = await response.json()
      setWhitelist(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load whitelist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWhitelist()
  }, [])

  const addSingleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return

    setAddingEmail(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: [newEmail.trim()],
          addedBy: 'admin-ui'
        })
      })

      const result = await response.json()
      
      if (!response.ok) throw new Error(result.error || 'Failed to add email')
      
      setSuccess(`Successfully added ${result.added} email(s)`)
      setNewEmail('')
      fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add email')
    } finally {
      setAddingEmail(false)
    }
  }

  const addBulkEmails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkEmails.trim()) return

    const emailList = bulkEmails
      .split(/[\n,;]/)
      .map(email => email.trim())
      .filter(email => email.length > 0)

    if (emailList.length === 0) return

    setAddingBulk(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          addedBy: 'admin-ui-bulk'
        })
      })

      const result = await response.json()
      
      if (!response.ok) throw new Error(result.error || 'Failed to add emails')
      
      setSuccess(`Successfully added ${result.added} email(s) out of ${result.validEmails} valid emails`)
      setBulkEmails('')
      fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add emails')
    } finally {
      setAddingBulk(false)
    }
  }

  const removeEmail = async (email: string) => {
    if (!confirm(`Är du säker på att du vill ta bort ${email} från whitelistan?`)) return

    try {
      const response = await fetch(`/api/admin/whitelist/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to remove email')
      }

      setSuccess(`Removed ${email} from whitelist`)
      fetchWhitelist()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove email')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Whitelist Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage email addresses that can access the application
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Add Single Email */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Add Single Email</h2>
        <form onSubmit={addSingleEmail} className="flex gap-4">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={addingEmail || !newEmail.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingEmail ? 'Adding...' : 'Add Email'}
          </button>
        </form>
      </div>

      {/* Bulk Add */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Bulk Add Emails</h2>
        <form onSubmit={addBulkEmails} className="space-y-4">
          <textarea
            value={bulkEmails}
            onChange={(e) => setBulkEmails(e.target.value)}
            placeholder="Enter emails separated by newlines, commas, or semicolons..."
            rows={6}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={addingBulk || !bulkEmails.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingBulk ? 'Adding...' : 'Add Bulk Emails'}
          </button>
        </form>
      </div>

      {/* Current Whitelist */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Current Whitelist ({whitelist.length} entries)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {whitelist.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.email}
                    {entry.is_admin && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.added_by}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(entry.added_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ 
                      entry.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => removeEmail(entry.email)}
                      className="text-red-600 hover:text-red-900"
                      disabled={entry.is_admin}
                    >
                      {entry.is_admin ? 'Protected' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}