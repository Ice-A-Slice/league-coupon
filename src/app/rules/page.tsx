import React from 'react';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Rules</h1>
            <div className="w-16 h-1 bg-blue-600 dark:bg-blue-400 rounded"></div>
          </div>

          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">How the Competition Works</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                The participants will compete by betting the outcome of the games in Premier League through a 
                <strong className="text-gray-900 dark:text-white"> 1×2 system</strong> where every correct answer gives the contester <strong className="text-gray-900 dark:text-white">one point</strong>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">First Round Bonus Questions</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                In the first round the participants also answers <strong className="text-gray-900 dark:text-white">four bonus questions</strong>, every 
                correct answer gives <strong className="text-gray-900 dark:text-white">three points</strong>.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong className="text-gray-900 dark:text-white">New for this year:</strong> You will be able to change one question the first round 
                after the Christmas Long Round.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Full Pot Bonus</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you collect a <strong className="text-gray-900 dark:text-white">full pot</strong> in a round we will <strong className="text-gray-900 dark:text-white">double your points</strong> 
                for that specific round!
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Missed Round Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you miss out of a round you will receive as many points as the <strong className="text-gray-900 dark:text-white">lowest score</strong> 
                of that specific round.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Bonus Rounds</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">Special Bonus Rounds</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                  The <strong className="text-gray-900 dark:text-white">last round of October</strong> and <strong className="text-gray-900 dark:text-white">first round of April</strong> will be 
                  bonus rounds for the <strong className="text-gray-900 dark:text-white">five contesters with the lowest score</strong> that places a bet.
                </p>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  In a bonus round every correct answer gives <strong className="text-gray-900 dark:text-white">two points</strong>.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">December Bonus Round</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  The <strong className="text-gray-900 dark:text-white">first round of December</strong> will be a bonus round for <strong className="text-gray-900 dark:text-white">all contesters</strong>.
                </p>
              </div>
            </section>

            <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-4">Quick Reference</h2>
              <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-3"></span>
                  Regular match prediction: <strong className="text-blue-900 dark:text-blue-100">1 point</strong>
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-3"></span>
                  First round bonus questions: <strong className="text-blue-900 dark:text-blue-100">3 points each</strong>
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-3"></span>
                  Bonus round predictions: <strong className="text-blue-900 dark:text-blue-100">2 points each</strong>
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-3"></span>
                  Full pot bonus: <strong className="text-blue-900 dark:text-blue-100">Double all round points</strong>
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-3"></span>
                  Missed round: <strong className="text-blue-900 dark:text-blue-100">Lowest score of that round</strong>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}