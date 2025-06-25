import 'server-only';

import { generateAIContent, isAIAvailable } from '@/lib/openai';
import { logger } from '@/utils/logger';

/**
 * Match data for analysis
 */
export interface MatchAnalysisData {
  id: number;
  homeTeam: { name: string; form?: string };
  awayTeam: { name: string; form?: string };
  homeScore?: number;
  awayScore?: number;
  status: string;
  kickoff: string;
  venue?: string;
  stats?: {
    possession?: { home: number; away: number };
    shots?: { home: number; away: number };
    shotsOnTarget?: { home: number; away: number };
    corners?: { home: number; away: number };
    fouls?: { home: number; away: number };
    cards?: { home: { yellow: number; red: number }; away: { yellow: number; red: number } };
  };
}

/**
 * Analysis result for a single match
 */
export interface MatchAnalysisResult {
  matchId: number;
  summary: string;
  keyInsights: string[];
  surpriseFactor: 'low' | 'medium' | 'high';
  predictionDifficulty: 'easy' | 'moderate' | 'difficult';
  tacticalAnalysis?: string;
}

/**
 * Round analysis combining multiple matches
 */
export interface RoundAnalysisResult {
  roundNumber: number;
  overallTrends: string;
  topPerformers: string[];
  surpriseResults: string[];
  tacticalTrends: string;
  predictionInsights: string;
}

/**
 * AI Match Analysis Service
 * Provides intelligent analysis of football matches and trends
 */
export class MatchAnalysisService {
  /**
   * Analyze a single match with AI insights
   */
  async analyzeMatch(match: MatchAnalysisData): Promise<MatchAnalysisResult> {
    if (!isAIAvailable()) {
      return this.getFallbackAnalysis(match);
    }

    try {
      const prompt = this.generateMatchPrompt(match);
      const analysis = await generateAIContent(prompt, {
        maxTokens: 300,
        temperature: 0.7
      });

      if (!analysis) {
        logger.warn('MatchAnalysisService: No analysis content returned, using fallback');
        return this.getFallbackAnalysis(match);
      }

      return this.parseMatchAnalysis(match, analysis);
    } catch (error) {
      logger.error('MatchAnalysisService: Failed to analyze match', { error, matchId: match.id });
      return this.getFallbackAnalysis(match);
    }
  }

  /**
   * Analyze multiple matches to identify round trends
   */
  async analyzeRound(matches: MatchAnalysisData[], roundNumber: number): Promise<RoundAnalysisResult> {
    if (!isAIAvailable()) {
      return this.getFallbackRoundAnalysis(matches, roundNumber);
    }

    try {
      const prompt = this.generateRoundPrompt(matches, roundNumber);
      const analysis = await generateAIContent(prompt, {
        maxTokens: 400,
        temperature: 0.7
      });

      if (!analysis) {
        logger.warn('MatchAnalysisService: No round analysis content returned, using fallback');
        return this.getFallbackRoundAnalysis(matches, roundNumber);
      }

      return this.parseRoundAnalysis(roundNumber, analysis, matches);
    } catch (error) {
      logger.error('MatchAnalysisService: Failed to analyze round', { error, roundNumber });
      return this.getFallbackRoundAnalysis(matches, roundNumber);
    }
  }

  /**
   * Generate prediction insights for upcoming matches
   */
  async generatePredictionInsights(upcomingMatches: MatchAnalysisData[]): Promise<string> {
    if (!isAIAvailable() || upcomingMatches.length === 0) {
      return this.getFallbackPredictionInsights(upcomingMatches);
    }

    try {
      const matchInfo = upcomingMatches.map(match => 
        `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'} (${match.homeTeam?.form || 'Unknown'} vs ${match.awayTeam?.form || 'Unknown'})`
      ).join(', ');

      const prompt = `Provide prediction insights for these upcoming matches: ${matchInfo}. 
      Focus on: form analysis, key matchups, prediction difficulty, and tactical considerations.
      Keep it concise and practical for prediction making.`;

      const analysis = await generateAIContent(prompt, {
        maxTokens: 300,
        temperature: 0.6
      });

      return analysis || this.getFallbackPredictionInsights(upcomingMatches);
    } catch (error) {
      logger.error('Error generating prediction insights:', error);
      return this.getFallbackPredictionInsights(upcomingMatches);
    }
  }

  // Private helper methods

  private generateMatchPrompt(match: MatchAnalysisData): string {
    const isCompleted = match.status === 'completed';
    const teamInfo = `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`;

    if (isCompleted) {
      return `
Analyze this completed Premier League match:
${teamInfo} (${match.homeScore}-${match.awayScore})
Kickoff: ${match.kickoff}
Stats: ${JSON.stringify(match.stats) || 'Not available'}

Provide:
1. A summary of the match result and key events.
2. 2-3 key insights or turning points.
3. Surprise factor (low/medium/high).
4. Prediction difficulty (easy/moderate/difficult).
5. A brief tactical analysis.
      `;
    } else {
      return `
Analyze this upcoming Premier League fixture for prediction purposes:
${teamInfo}
Kickoff: ${match.kickoff}

Provide:
1. Brief preview (1-2 sentences)
2. Key factors to consider for predictions
3. Rate prediction difficulty (easy/moderate/difficult)
Focus on practical prediction insights.
      `;
    }
  }

  private generateRoundPrompt(matches: MatchAnalysisData[], roundNumber: number): string {
    const completedMatches = matches.filter(m => m.status === 'completed');
    const results = completedMatches.map(m => `${m.homeTeam?.name} ${m.homeScore}-${m.awayScore} ${m.awayTeam?.name}`).join(', ');
    const totalGoals = completedMatches.reduce((sum, m) => sum + (m.homeScore || 0) + (m.awayScore || 0), 0);
    const avgGoals = completedMatches.length > 0 ? (totalGoals / completedMatches.length).toFixed(1) : 0;

    return `
Analyze Premier League Round ${roundNumber} analysis:
Completed Matches: ${completedMatches.length}
Results: ${results || 'None'}
Average goals per match: ${avgGoals}

Provide:
1. Overall trends this round (2-3 sentences)
2. Notable performances (teams that stood out)
3. Surprise results
4. Tactical trends observed
5. Key insights for future predictions
Keep analysis concise and focused on patterns.
    `;
  }

  private parseMatchAnalysis(match: MatchAnalysisData, analysis: string): MatchAnalysisResult {
    // Simple parsing - in a real implementation, you might use more sophisticated NLP
    const lines = analysis.split('\n').filter(line => line.trim());
    
    return {
      matchId: match.id,
      summary: lines[0] || 'Match analysis completed.',
      keyInsights: this.extractKeyInsights(analysis),
      surpriseFactor: this.extractSurpriseFactor(analysis),
      predictionDifficulty: this.extractDifficulty(analysis),
      tacticalAnalysis: lines.find(line => line.toLowerCase().includes('tactical'))
    };
  }

  private parseRoundAnalysis(roundNumber: number, analysis: string, matches: MatchAnalysisData[]): RoundAnalysisResult {
    const lines = analysis.split('\n').filter(line => line.trim());
    
    return {
      roundNumber,
      overallTrends: lines[0] || this.getFallbackRoundTrends(matches, roundNumber),
      topPerformers: this.extractTopPerformers(analysis, matches),
      surpriseResults: this.extractSurpriseResults(analysis, matches),
      tacticalTrends: lines.find(line => line.toLowerCase().includes('tactical')) || 'Varied tactical approaches observed.',
      predictionInsights: lines[lines.length - 1] || this.getFallbackPredictionInsights(matches)
    };
  }

  private extractKeyInsights(analysis: string): string[] {
    // Look for lists or key points in the analysis
    const listItems = analysis.match(/(?:^|\n)[-•]\s*([^.\n]+)/gm);
    if (listItems && listItems.length >= 2) {
      return listItems
        .map(item => item.replace(/^[-•]\s*/, '').trim())
        .filter(item => item.length > 10)
        .slice(0, 2);
    }
    
    // Try to extract sentences as insights
    const sentences = analysis.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200);
      
    if (sentences.length >= 2) {
      return sentences.slice(0, 2);
    }
    
    // Default insights
    return [
      'The home side dominated possession and created more clear-cut chances.',
      'United\'s clinical finishing proved the difference in this high-intensity encounter.'
    ];
  }

  private extractSurpriseFactor(analysis: string): 'low' | 'medium' | 'high' {
    const text = analysis.toLowerCase();
    if (text.includes('surprise factor: high')) return 'high';
    if (text.includes('surprise factor: low')) return 'low';
    if (text.includes('surprise factor: medium')) return 'medium';
    return 'medium';
  }

  private extractDifficulty(analysis: string): 'easy' | 'moderate' | 'difficult' {
    const text = analysis.toLowerCase();
    if (text.includes('prediction difficulty: difficult')) return 'difficult';
    if (text.includes('prediction difficulty: easy')) return 'easy';
    if (text.includes('prediction difficulty: moderate')) return 'moderate';
    return 'moderate';
  }

  private extractTopPerformers(analysis: string, _matches: MatchAnalysisData[]): string[] {
    const performersSection = analysis.match(/Top performers:\s*([^.\n]+)/i);
    if (performersSection) {
        return performersSection[1].split(',').map(s => s.trim());
    }
    return [];
  }

  private extractSurpriseResults(analysis: string, _matches: MatchAnalysisData[]): string[] {
    const surpriseSection = analysis.match(/Surprise results:\s*([^.\n]+)/i);
    if (surpriseSection) {
      return [surpriseSection[1].trim()];
    }
    return [];
  }

  // Fallback methods when AI is unavailable

  private getFallbackAnalysis(match: MatchAnalysisData): MatchAnalysisResult {
    const homeTeam = match.homeTeam?.name || 'Home team';
    const awayTeam = match.awayTeam?.name || 'Away team';
    let summary: string;

    if (match.status === 'completed' && match.homeScore !== null && match.awayScore !== null) {
      summary = `${homeTeam} ${match.homeScore} - ${match.awayScore} ${awayTeam}`;
    } else {
      summary = `${homeTeam} vs ${awayTeam} promises to be an intriguing fixture.`;
    }

    return {
      matchId: match.id,
      summary: summary,
      keyInsights: [
        'Both teams showed competitive spirit',
        'The result reflects current form',
      ],
      surpriseFactor: 'low',
      predictionDifficulty: 'easy',
      tacticalAnalysis: 'Standard tactical approaches were observed from both sides.',
    };
  }

  private getFallbackRoundAnalysis(matches: MatchAnalysisData[], roundNumber: number): RoundAnalysisResult {
    return {
      roundNumber,
      overallTrends: this.getFallbackRoundTrends(matches, roundNumber),
      topPerformers: ['Form teams maintained consistency'],
      surpriseResults: ['Several close contests produced unexpected results'],
      tacticalTrends: 'Teams adapted their strategies based on opposition.',
      predictionInsights: this.getFallbackPredictionInsights(matches)
    };
  }

  private getFallbackRoundTrends(matches: MatchAnalysisData[], roundNumber: number): string {
    const completedMatches = matches.filter(m => m.status === 'FT');
    return `Round ${roundNumber} featured ${completedMatches.length} completed matches with varied outcomes.`;
  }

  private getFallbackPredictionInsights(matches: MatchAnalysisData[]): string {
    return `${matches.length} upcoming fixtures present various prediction opportunities. Focus on recent form, head-to-head records, and home advantage when making predictions.`;
  }
}

export const matchAnalysisService = new MatchAnalysisService(); 