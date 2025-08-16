import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Rules",
  description: "Competition rules and scoring system",
};

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Rules</h1>
            <div className="w-16 h-1 bg-teal-600 dark:bg-teal-400 rounded"></div>
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
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">The Questions</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                In the first round the participants also answers <strong className="text-gray-900 dark:text-white">four questions</strong>, every 
                correct answer gives <strong className="text-gray-900 dark:text-white">three points</strong>.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong className="text-gray-900 dark:text-white">New for this year:</strong> You will be able to change one question the first round 
                in December.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Full Pot Bonus</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you collect a <strong className="text-gray-900 dark:text-white">full pot</strong> in a round we will <strong className="text-gray-900 dark:text-white">double your points</strong> for 
                that specific round!
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Missed Round Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you miss out of a round you will receive as many points as the <strong className="text-gray-900 dark:text-white">lowest score</strong> of 
                that specific round.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Last Round Special</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                During the <strong className="text-gray-900 dark:text-white">last five rounds</strong> of the season we will play the cup called the 
                <strong className="text-gray-900 dark:text-white"> Last Round Special</strong> where we count the points earned from fixtures during the 
                last five rounds to crown the cup winner.
              </p>
            </section>

            <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Quick Reference</h2>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full mr-3 mt-2"></span>
                  <span>Regular match prediction: <strong className="text-gray-900 dark:text-gray-100">1 point</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full mr-3 mt-2"></span>
                  <span>The questions: <strong className="text-gray-900 dark:text-gray-100">3 points each</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full mr-3 mt-2"></span>
                  <span>Full pot bonus: <strong className="text-gray-900 dark:text-gray-100">Double all round points</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full mr-3 mt-2"></span>
                  <span>Change one answer: <strong className="text-gray-900 dark:text-gray-100">First round in December</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full mr-3 mt-2"></span>
                  <span>Last Round Special: <strong className="text-gray-900 dark:text-gray-100">Last five rounds of the season</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full mr-3 mt-2"></span>
                  <span>Missed round: <strong className="text-gray-900 dark:text-gray-100">Lowest score of that round</strong></span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}