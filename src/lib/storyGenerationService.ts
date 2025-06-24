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
  lateGoals: Array<{ player: { name: string }; team: string; minute: number }>;
  comebacks: Array<{ team: string; from: number; to: number }>;
  redCards: Array<{ player: { name: string }; team: string; minute: number }>;
} {
  const lateGoals = events.filter(
    event => event.type === 'Goal' && event.time.elapsed >= 75
  ).map(goal => ({
    player: { name: goal.player.name },
    team: goal.team.name,
    minute: goal.time.elapsed + (goal.time.extra || 0)
  }));
  
  const redCards = events.filter(
    event => event.type === 'Card' && event.detail === 'Red Card'
  ).map(card => ({
    player: { name: card.player.name },
    team: card.team.name,
    minute: card.time.elapsed + (card.time.extra || 0)
  }));

  // Analyze comebacks by tracking score progression
  const comebacks: Array<{ team: string; from: number; to: number }> = [];
  const scoreTracker: { [teamId: number]: number } = {};
  const teamNames: { [teamId: number]: string } = {};
  
  events
    .filter(event => event.type === 'Goal')
    .sort((a, b) => a.time.elapsed - b.time.elapsed)
    .forEach(goal => {
      teamNames[goal.team.id] = goal.team.name;
      scoreTracker[goal.team.id] = (scoreTracker[goal.team.id] || 0) + 1;
      
      // Check if this goal creates a comeback scenario
      const teamIds = Object.keys(scoreTracker).map(Number);
      if (teamIds.length === 2) {
        const [team1Id, team2Id] = teamIds;
        const team1Score = scoreTracker[team1Id] || 0;
        const team2Score = scoreTracker[team2Id] || 0;
        
        // Check if current team was behind before this goal and now leads/ties
        if (goal.team.id === team1Id && goal.time.elapsed > 30) {
          const previousScore = team1Score - 1;
          if (previousScore < team2Score && team1Score >= team2Score) {
            comebacks.push({ 
              team: teamNames[team1Id], 
              from: team2Score - previousScore, 
              to: previousScore 
            });
          }
        } else if (goal.team.id === team2Id && goal.time.elapsed > 30) {
          const previousScore = team2Score - 1;
          if (previousScore < team1Score && team2Score >= team1Score) {
            comebacks.push({ 
              team: teamNames[team2Id], 
              from: team1Score - previousScore, 
              to: previousScore 
            });
          }
        }
      }
    });

  return { lateGoals, redCards, comebacks };
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
  topScorer: { name: string; goals: number } | null;
  topAssister: { name: string; assists: number } | null;
  highestRated: { name: string; rating: number } | null;
} {
  let topScorer: { name: string; goals: number } | null = null;
  let topAssister: { name: string; assists: number } | null = null;
  let highestRated: { name: string; rating: number } | null = null;

  if (!playerStats || playerStats.length === 0) {
    return { topScorer, topAssister, highestRated };
  }

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
      if (!topAssister || stats.goals.assists > topAssister.assists) {
        topAssister = { name: playerStat.player.name, assists: stats.goals.assists };
      }
    }

    // Check for high ratings
    if (stats.games.rating) {
      const rating = parseFloat(stats.games.rating);
      if (!highestRated || rating > highestRated.rating) {
        highestRated = { name: playerStat.player.name, rating };
      }
    }
  });

  return { topScorer, topAssister, highestRated };
}

/**
 * Generates a match story based on comprehensive match data
 */
export function generateMatchStory(
  fixture: ApiFixtureResponseItem,
  events: ApiEvent[],
  playerStats: ApiPlayerMatchStats[]
): MatchStory {
  const { home: homeTeam, away: awayTeam } = fixture.teams;
  const { home: homeScore, away: awayScore } = fixture.goals;
  
  // Handle null scores (match not started or data not available)
  const finalHomeScore = homeScore ?? 0;
  const finalAwayScore = awayScore ?? 0;
  
  const dramaticMoments = analyzeDramaticMoments(events);
  const playerPerformances = analyzePlayerPerformances(playerStats);

  // Determine story category and importance
  let category: MatchStory['category'] = 'performance';
  let importance: MatchStory['importance'] = 'medium';
  
  // Check for special scenarios - hat-trick takes priority
  if (playerPerformances.topScorer && playerPerformances.topScorer.goals >= 3) {
    category = 'performance';
    importance = 'high';
  } else if (dramaticMoments.comebacks.length > 0) {
    category = 'drama';
    importance = 'high';
  } else if (dramaticMoments.redCards.length > 0) {
    category = 'drama';
    importance = 'high';
  } else if (dramaticMoments.lateGoals.length > 0) {
    category = 'drama';
    importance = 'medium';
  }

  // Generate headline - hat-trick takes priority
  let headline = `${homeTeam.name} ${finalHomeScore}-${finalAwayScore} ${awayTeam.name}`;
  
  if (playerPerformances.topScorer && playerPerformances.topScorer.goals >= 3) {
    headline = `Hat-trick Hero ${playerPerformances.topScorer.name} Leads ${homeTeam.name} vs ${awayTeam.name}`;
  } else if (dramaticMoments.comebacks.length > 0) {
    const comeback = dramaticMoments.comebacks[0];
    headline = `${comeback.team} Complete Stunning Comeback Against ${homeTeam.name === comeback.team ? awayTeam.name : homeTeam.name}`;
  } else if (dramaticMoments.lateGoals.length > 0) {
    const lateGoal = dramaticMoments.lateGoals[0];
    headline = `Late Drama as ${lateGoal.player.name} Strikes for ${lateGoal.team}`;
  }

  // Generate content
  let content = `${homeTeam.name} ${finalHomeScore > finalAwayScore ? 'defeated' : finalHomeScore < finalAwayScore ? 'lost to' : 'drew with'} ${awayTeam.name} ${finalHomeScore}-${finalAwayScore}`;
  
  if (dramaticMoments.lateGoals.length > 0) {
    content += ` in dramatic fashion with ${dramaticMoments.lateGoals.length} late goal${dramaticMoments.lateGoals.length > 1 ? 's' : ''}`;
  }
  
  if (playerPerformances.topScorer) {
    content += `. ${playerPerformances.topScorer.name} was the star with ${playerPerformances.topScorer.goals} goal${playerPerformances.topScorer.goals > 1 ? 's' : ''}`;
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
      ...(playerPerformances.topAssister ? [playerPerformances.topAssister.name] : []),
      ...(playerPerformances.highestRated ? [playerPerformances.highestRated.name] : []),
    ],
  };
}

/**
 * Generates league stories from multiple match results
 */
export function generateLeagueStories(matchStories: MatchStory[], roundName: string): LeagueStories {
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
  
  let roundSummary;
  if (totalMatches === 0) {
    roundSummary = `${roundName} was a quiet round of Premier League action with limited drama.`;
  } else {
    roundSummary = `${roundName} delivered thrilling Premier League action with ${totalMatches} matches`;
    if (dramaCount > 0) {
      roundSummary += `, featuring ${dramaCount} dramatic encounter${dramaCount > 1 ? 's' : ''}`;
    }
    if (upsetCount > 0) {
      roundSummary += ` and ${upsetCount} surprise result${upsetCount > 1 ? 's' : ''}`;
    }
    roundSummary += '.';
  }

  // Find week highlights
  const weekHighlights: LeagueStories['weekHighlights'] = {};
  
  const upsetStory = matchStories.find(s => s.category === 'upset' && s.importance === 'high');
  if (upsetStory) {
    weekHighlights.upsetOfTheWeek = upsetStory.headline;
  } else {
    // Fallback: use any high importance story as upset
    const highImportanceStory = matchStories.find(s => s.importance === 'high');
    if (highImportanceStory) {
      weekHighlights.upsetOfTheWeek = highImportanceStory.headline;
    }
  }

  const performanceStory = matchStories.find(s => s.category === 'performance' && s.keyPlayers.length > 0);
  if (performanceStory) {
    weekHighlights.performanceOfTheWeek = `${performanceStory.keyPlayers[0]} starred in ${performanceStory.headline}`;
  } else {
    // Fallback: use any story with key players
    const storyWithPlayers = matchStories.find(s => s.keyPlayers.length > 0);
    if (storyWithPlayers) {
      weekHighlights.performanceOfTheWeek = `${storyWithPlayers.keyPlayers[0]} starred in ${storyWithPlayers.headline}`;
    }
  }

  return {
    roundSummary,
    topStories,
    weekHighlights,
  };
} 