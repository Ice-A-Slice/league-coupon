import type {
  ApiEvent,
  ApiTeamStatistics,
  ApiPlayerMatchStats,
  ApiFixtureResponseItem,
} from '@/services/football-api/types';

// Types for story generation
export interface MatchStory {
  headline: string;
  content: string;
  category: 'upset' | 'drama' | 'performance' | 'milestone' | 'form' | 'title_race';
  importance: 'high' | 'medium' | 'low';
  teams: string[];
  keyPlayers: string[];
}

export interface LeagueStories {
  roundSummary: string;
  topStories: MatchStory[];
  weekHighlights: {
    goalOfTheWeek?: string;
    performanceOfTheWeek?: string;
    upsetOfTheWeek?: string;
  };
}

/**
 * Analyzes match events to identify dramatic moments
 */
export function analyzeDramaticMoments(events: ApiEvent[]): {
  lateGoals: ApiEvent[];
  redCards: ApiEvent[];
  penalties: ApiEvent[];
  comebacks: { team: string; deficit: number }[];
} {
  const lateGoals = events.filter(
    event => event.type === 'Goal' && event.time.elapsed >= 75
  );
  
  const redCards = events.filter(
    event => event.type === 'Card' && event.detail === 'Red Card'
  );
  
  const penalties = events.filter(
    event => event.type === 'Goal' && event.detail === 'Penalty'
  );

  // Analyze comebacks by tracking score progression
  const comebacks: { team: string; deficit: number }[] = [];
  const scoreTracker: { [teamId: number]: number } = {};
  
  events
    .filter(event => event.type === 'Goal')
    .sort((a, b) => a.time.elapsed - b.time.elapsed)
    .forEach(goal => {
      scoreTracker[goal.team.id] = (scoreTracker[goal.team.id] || 0) + 1;
      
      // Check if this goal creates a comeback scenario
      const teamScore = scoreTracker[goal.team.id];
      const opponentScore = Object.values(scoreTracker).find(score => score !== teamScore) || 0;
      
      if (teamScore > opponentScore && goal.time.elapsed > 60) {
        const deficit = opponentScore - (teamScore - 1);
        if (deficit > 0) {
          comebacks.push({ team: goal.team.name, deficit });
        }
      }
    });

  return { lateGoals, redCards, penalties, comebacks };
}

/**
 * Analyzes team statistics to identify standout performances
 */
export function analyzeTeamPerformance(statistics: ApiTeamStatistics[]): {
  dominantTeam?: string;
  defensiveDisplay?: string;
  attackingDisplay?: string;
  possessionBattle?: { winner: string; percentage: number };
} {
  if (statistics.length !== 2) return {};

  const [team1, team2] = statistics;
  
  // Find possession statistics
  const team1Possession = team1.statistics.find(s => s.type === 'Ball Possession');
  const team2Possession = team2.statistics.find(s => s.type === 'Ball Possession');
  
  let possessionBattle;
  if (team1Possession && team2Possession) {
    const team1Poss = parseInt(String(team1Possession.value).replace('%', ''));
    const team2Poss = parseInt(String(team2Possession.value).replace('%', ''));
    
    if (Math.abs(team1Poss - team2Poss) > 15) {
      possessionBattle = {
        winner: team1Poss > team2Poss ? team1.team.name : team2.team.name,
        percentage: Math.max(team1Poss, team2Poss),
      };
    }
  }

  // Analyze shots and defensive stats
  const team1Shots = team1.statistics.find(s => s.type === 'Total Shots');
  const team2Shots = team2.statistics.find(s => s.type === 'Total Shots');
  
  let dominantTeam;
  if (team1Shots && team2Shots) {
    const shots1 = Number(team1Shots.value) || 0;
    const shots2 = Number(team2Shots.value) || 0;
    
    if (shots1 > shots2 * 2) {
      dominantTeam = team1.team.name;
    } else if (shots2 > shots1 * 2) {
      dominantTeam = team2.team.name;
    }
  }

  return { dominantTeam, possessionBattle };
}

/**
 * Identifies standout player performances
 */
export function analyzePlayerPerformances(playerStats: ApiPlayerMatchStats[]): {
  manOfTheMatch?: string;
  topScorer?: { name: string; goals: number };
  keyAssists?: { name: string; assists: number };
  standoutRating?: { name: string; rating: number };
} {
  let topScorer: { name: string; goals: number } | undefined;
  let keyAssists: { name: string; assists: number } | undefined;
  let standoutRating: { name: string; rating: number } | undefined;

  playerStats.forEach(playerStat => {
    const stats = playerStat.statistics[0]; // Usually first stats object
    if (!stats) return;

    // Check for goals
    if (stats.goals.total && stats.goals.total > 0) {
      if (!topScorer || stats.goals.total > topScorer.goals) {
        topScorer = { name: playerStat.player.name, goals: stats.goals.total };
      }
    }

    // Check for assists
    if (stats.goals.assists && stats.goals.assists > 0) {
      if (!keyAssists || stats.goals.assists > keyAssists.assists) {
        keyAssists = { name: playerStat.player.name, assists: stats.goals.assists };
      }
    }

    // Check for high ratings
    if (stats.games.rating) {
      const rating = parseFloat(stats.games.rating);
      if (rating > 8.5) {
        if (!standoutRating || rating > standoutRating.rating) {
          standoutRating = { name: playerStat.player.name, rating };
        }
      }
    }
  });

  return { topScorer, keyAssists, standoutRating };
}

/**
 * Generates a match story based on comprehensive match data
 */
export function generateMatchStory(
  fixture: ApiFixtureResponseItem,
  events: ApiEvent[],
  statistics: ApiTeamStatistics[],
  playerStats: ApiPlayerMatchStats[]
): MatchStory {
  const { home: homeTeam, away: awayTeam } = fixture.teams;
  const { home: homeScore, away: awayScore } = fixture.goals;
  
  // Handle null scores (match not started or data not available)
  const finalHomeScore = homeScore ?? 0;
  const finalAwayScore = awayScore ?? 0;
  
  const dramaticMoments = analyzeDramaticMoments(events);
  const teamPerformance = analyzeTeamPerformance(statistics);
  const playerPerformances = analyzePlayerPerformances(playerStats);

  // Determine story category and importance
  let category: MatchStory['category'] = 'performance';
  let importance: MatchStory['importance'] = 'medium';
  
  // Check for upsets (this would need league position data in real implementation)
  if (dramaticMoments.comebacks.length > 0) {
    category = 'drama';
    importance = 'high';
  } else if (dramaticMoments.redCards.length > 0) {
    category = 'drama';
    importance = 'high';
  } else if (dramaticMoments.lateGoals.length > 0) {
    category = 'drama';
    importance = 'medium';
  }

  // Generate headline
  let headline = `${homeTeam.name} ${finalHomeScore}-${finalAwayScore} ${awayTeam.name}`;
  
  if (dramaticMoments.comebacks.length > 0) {
    const comeback = dramaticMoments.comebacks[0];
    headline = `${comeback.team} Complete Stunning Comeback Against ${homeTeam.name === comeback.team ? awayTeam.name : homeTeam.name}`;
  } else if (dramaticMoments.lateGoals.length > 0) {
    const lateGoal = dramaticMoments.lateGoals[0];
    headline = `Late Drama as ${lateGoal.player.name} Strikes for ${lateGoal.team.name}`;
  } else if (playerPerformances.topScorer && playerPerformances.topScorer.goals > 2) {
    headline = `${playerPerformances.topScorer.name} Hat-trick Heroics in ${homeTeam.name} vs ${awayTeam.name}`;
  }

  // Generate content
  let content = `${homeTeam.name} ${finalHomeScore > finalAwayScore ? 'defeated' : finalHomeScore < finalAwayScore ? 'lost to' : 'drew with'} ${awayTeam.name} ${finalHomeScore}-${finalAwayScore}`;
  
  if (dramaticMoments.lateGoals.length > 0) {
    content += ` in dramatic fashion with ${dramaticMoments.lateGoals.length} late goal${dramaticMoments.lateGoals.length > 1 ? 's' : ''}`;
  }
  
  if (playerPerformances.topScorer) {
    content += `. ${playerPerformances.topScorer.name} was the star with ${playerPerformances.topScorer.goals} goal${playerPerformances.topScorer.goals > 1 ? 's' : ''}`;
  }
  
  if (teamPerformance.possessionBattle) {
    content += `. ${teamPerformance.possessionBattle.winner} dominated possession with ${teamPerformance.possessionBattle.percentage}%`;
  }

  content += '.';

  return {
    headline,
    content,
    category,
    importance,
    teams: [homeTeam.name, awayTeam.name],
    keyPlayers: [
      ...(playerPerformances.topScorer ? [playerPerformances.topScorer.name] : []),
      ...(playerPerformances.keyAssists ? [playerPerformances.keyAssists.name] : []),
      ...(playerPerformances.standoutRating ? [playerPerformances.standoutRating.name] : []),
    ],
  };
}

/**
 * Generates league stories from multiple match results
 */
export function generateLeagueStories(matchStories: MatchStory[]): LeagueStories {
  const topStories = matchStories
    .sort((a, b) => {
      const importanceOrder = { high: 3, medium: 2, low: 1 };
      return importanceOrder[b.importance] - importanceOrder[a.importance];
    })
    .slice(0, 3);

  // Generate round summary
  const totalMatches = matchStories.length;
  const dramaCount = matchStories.filter(s => s.category === 'drama').length;
  const upsetCount = matchStories.filter(s => s.category === 'upset').length;
  
  let roundSummary = `Another thrilling round of Premier League action with ${totalMatches} matches`;
  if (dramaCount > 0) {
    roundSummary += `, featuring ${dramaCount} dramatic encounter${dramaCount > 1 ? 's' : ''}`;
  }
  if (upsetCount > 0) {
    roundSummary += ` and ${upsetCount} surprise result${upsetCount > 1 ? 's' : ''}`;
  }
  roundSummary += '.';

  // Find week highlights
  const weekHighlights: LeagueStories['weekHighlights'] = {};
  
  const upsetStory = matchStories.find(s => s.category === 'upset' && s.importance === 'high');
  if (upsetStory) {
    weekHighlights.upsetOfTheWeek = upsetStory.headline;
  }

  const performanceStory = matchStories.find(s => s.category === 'performance' && s.keyPlayers.length > 0);
  if (performanceStory) {
    weekHighlights.performanceOfTheWeek = `${performanceStory.keyPlayers[0]} starred in ${performanceStory.headline}`;
  }

  return {
    roundSummary,
    topStories,
    weekHighlights,
  };
} 