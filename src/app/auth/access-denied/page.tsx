import Link from 'next/link'

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-500 via-purple-500 to-blue-600 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="mb-6">
            <svg 
              className="mx-auto h-16 w-16 text-red-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Åtkomst nekad
          </h1>
          
          <p className="text-gray-600 mb-6">
            Du är inte registrerad för tävlingen ännu.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              Vänligen kontakta:
            </p>
            <a 
              href="mailto:pierluigi@apl.zone" 
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              pierluigi@apl.zone
            </a>
            <p className="text-sm text-gray-700 mt-2">
              för att få tillgång
            </p>
          </div>
          
          <div className="space-y-3">
            <Link 
              href="/auth/signin" 
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Försök logga in igen
            </Link>
            
            <Link 
              href="/" 
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Tillbaka till startsidan
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}