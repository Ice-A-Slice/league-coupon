import React from 'react';

// Test data inspired by the screenshots provided
const testSeasons = [
  {
    year: "2024-25",
    leagueWinner: {
      name: "Arnar Johannsson",
      points: 89
    },
    cupWinner: {
      name: "Guðbjörg Steinsdóttir", 
      points: 34
    }
  },
  {
    year: "2021-22", 
    leagueWinner: {
      name: "Heimir Þorsteinsson",
      points: 156
    },
    cupWinner: {
      name: "Heimir Þorsteinsson",
      points: 45
    }
  },
  {
    year: "2020-21",
    leagueWinner: {
      name: "Róbert Wessman", 
      points: 142
    },
    cupWinner: {
      name: "Laurentiu Scheusan",
      points: 38
    }
  },
  {
    year: "2015-16",
    leagueWinner: {
      name: "Aron Kristinsson & Laurentiu Scheusan",
      points: 128
    },
    cupWinner: {
      name: "Laurentiu Scheusan & Sævar Alexandersson", 
      points: 42
    }
  }
];

function CircularBadge({ 
  type, 
  name, 
  points 
}: { 
  type: 'league' | 'cup'; 
  name: string; 
  points: number; 
}) {
  const isLeague = type === 'league';
  
  return (
    <div className="flex flex-col items-center space-y-3">
      <div className={`
        w-40 h-40 rounded-full flex flex-col items-center justify-center text-white text-center p-4
        ${isLeague 
          ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-yellow-200' 
          : 'bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-orange-200'
        }
        shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105
      `}>
        <div className="text-xs font-medium mb-1 opacity-90">
          {isLeague ? 'League Winner' : 'Last Round Winner'}
        </div>
        <div className="text-sm font-bold leading-tight">
          {name}
        </div>
        <div className="text-xs mt-2 opacity-90">
          {points} points
        </div>
      </div>
    </div>
  );
}

export default function TestHallOfFamePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hall of Fame</h1>
        <p className="text-gray-600">Celebrating our champions across the seasons</p>
      </div>

      <div className="space-y-12">
        {testSeasons.map((season) => (
          <div key={season.year} className="space-y-6">
            {/* Season Year Header */}
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-800">{season.year}</h2>
            </div>

            {/* Winners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center">
              {season.leagueWinner && (
                <CircularBadge 
                  type="league"
                  name={season.leagueWinner.name}
                  points={season.leagueWinner.points}
                />
              )}
              
              {season.cupWinner && (
                <CircularBadge 
                  type="cup"
                  name={season.cupWinner.name}  
                  points={season.cupWinner.points}
                />
              )}
            </div>

            {/* Divider */}
            {season !== testSeasons[testSeasons.length - 1] && (
              <div className="border-b border-gray-200 mt-8"></div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-12 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Legend</h3>
        <div className="flex justify-center space-x-8">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600"></div>
            <span className="text-sm text-gray-700">League Winner</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600"></div>
            <span className="text-sm text-gray-700">Last Round Special Winner</span>
          </div>
        </div>
      </div>
    </div>
  );
} 