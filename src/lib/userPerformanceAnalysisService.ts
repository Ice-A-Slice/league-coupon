import 'server-only';

import { generateAIContent, isAIAvailable } from '@/lib/openai';
import { logger } from '@/utils/logger';

/**
 * Round performance data
 */
export interface RoundPerformance {
  roundNumber: number;
  points: number;
  predictions: number;
  correct: number;
}

/**
 * User performance data for analysis
 */
export interface UserPerformanceData {
  userId: string;
  username: string;
  totalRounds: number;
  totalPoints: number;
  averagePoints: number;
  recentRounds: RoundPerformance[];
  strongAreas: string[];
  weakAreas: string[];
  rankPosition: number;
  totalPlayers: number;
}

/**
 * User analysis result
 */
export interface UserAnalysisResult {
  userId: string;
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  performanceTrend: 'improving' | 'declining' | 'stable' | 'maintaining';
  confidenceLevel: 'low' | 'building' | 'moderate' | 'high';
  motivationalMessage: string;
}

/**
 * AI User Performance Analysis Service
 */
export class UserPerformanceAnalysisService {
  /**
   * Analyze user performance and generate insights
   */
  async analyzeUserPerformance(userData: UserPerformanceData): Promise<UserAnalysisResult> {
    if (!isAIAvailable()) {
      return this.getFallbackAnalysis(userData);
    }

    try {
      const prompt = this.buildAnalysisPrompt(userData);
      const analysis = await generateAIContent(prompt, {
        maxTokens: 400,
        temperature: 0.7
      });

      if (!analysis) {
        logger.warn('UserPerformanceAnalysisService: No analysis content returned, using fallback');
        return this.getFallbackAnalysis(userData);
      }

      return this.parseAnalysis(userData, analysis);
    } catch (error) {
      logger.error('UserPerformanceAnalysisService: Failed to analyze performance', { error, userId: userData.userId });
      return this.getFallbackAnalysis(userData);
    }
  }

  /**
   * Generate improvement suggestions for user
   */
  async generateImprovementSuggestions(userData: UserPerformanceData): Promise<string[]> {
    if (!isAIAvailable()) {
      return this.getFallbackSuggestions(userData);
    }

    try {
      const prompt = `
Generate 3-5 specific improvement suggestions for ${userData.username}'s football prediction performance:

Current Performance:
- Average Points: ${userData.averagePoints}
- Total Rounds: ${userData.totalRounds}
- Rank: ${userData.rankPosition}/${userData.totalPlayers}
- Strong Areas: ${userData.strongAreas.join(', ') || 'None identified'}
- Weak Areas: ${userData.weakAreas.join(', ') || 'None identified'}

Recent Form: ${userData.recentRounds.map(r => `Round ${r.roundNumber}: ${r.points} pts (${r.correct}/${r.predictions})`).join(', ')}

Provide actionable, specific suggestions numbered 1-5. Focus on concrete strategies.
      `;

      const suggestions = await generateAIContent(prompt, {
        maxTokens: 250,
        temperature: 0.7
      });

      if (!suggestions) {
        logger.warn('UserPerformanceAnalysisService: No suggestions content returned, using fallback');
        return this.getFallbackSuggestions(userData);
      }

      return this.parseSuggestions(suggestions);
    } catch (error) {
      logger.error('UserPerformanceAnalysisService: Failed to generate suggestions', { error, userId: userData.userId });
      return this.getFallbackSuggestions(userData);
    }
  }

  /**
   * Generate motivational message for user
   */
  async generateMotivationalMessage(userData: UserPerformanceData): Promise<string> {
    if (!isAIAvailable()) {
      return this.getFallbackMotivationalMessage(userData);
    }

    try {
      const prompt = `
Generate an encouraging motivational message for ${userData.username}:

Performance Summary:
- Total Points: ${userData.totalPoints}
- Average: ${userData.averagePoints} points per round
- Rank: ${userData.rankPosition}/${userData.totalPlayers}

Keep it positive, personal, and under 50 words. Address them by name.
      `;

      const message = await generateAIContent(prompt, {
        maxTokens: 100,
        temperature: 0.8
      });

      if (!message) {
        logger.warn('UserPerformanceAnalysisService: No motivational message content returned, using fallback');
        return this.getFallbackMotivationalMessage(userData);
      }

      return message.trim();
    } catch (error) {
      logger.error('UserPerformanceAnalysisService: Failed to generate motivational message', { error, userId: userData.userId });
      return this.getFallbackMotivationalMessage(userData);
    }
  }

  private buildAnalysisPrompt(userData: UserPerformanceData): string {
    const recentTrend = this.calculateTrend(userData.recentRounds);
    
    return `
Analyze ${userData.username}'s football prediction performance:

Overall Stats:
- Total Points: ${userData.totalPoints} over ${userData.totalRounds} rounds
- Average: ${userData.averagePoints} points per round
- Current Rank: ${userData.rankPosition}/${userData.totalPlayers}

Recent Performance: ${userData.recentRounds.map(r => `Round ${r.roundNumber}: ${r.points} pts`).join(', ')}
Strong Areas: ${userData.strongAreas.join(', ') || 'To be identified'}
Weak Areas: ${userData.weakAreas.join(', ') || 'To be identified'}

Provide analysis with:
1. Summary paragraph
2. 2-3 key strengths
3. 2-3 improvement areas
4. Performance trend: ${recentTrend}
5. Confidence level assessment

Be encouraging and constructive.
    `;
  }

  private parseAnalysis(userData: UserPerformanceData, analysis: string): UserAnalysisResult {
    const lines = analysis.split('\n').filter(line => line.trim());
    
    // Extract summary (first substantial line)
    const summary = lines.find(line => line.length > 20) || `${userData.username} shows consistent engagement in predictions.`;
    
    // Extract trend from analysis
    const trendMatch = analysis.match(/trend[:\s]*(improving|declining|stable|maintaining)/i);
    const trend = (trendMatch?.[1]?.toLowerCase() as 'improving' | 'declining' | 'stable' | 'maintaining') || this.calculateTrend(userData.recentRounds);
    
    // Extract confidence level
    const confidenceMatch = analysis.match(/confidence[:\s]*(low|building|moderate|high)/i);
    const confidence = (confidenceMatch?.[1]?.toLowerCase() as 'low' | 'building' | 'moderate' | 'high') || this.calculateConfidenceLevel(userData);

    return {
      userId: userData.userId,
      summary,
      strengths: this.extractStrengths(analysis, userData),
      improvementAreas: this.extractImprovementAreas(analysis, userData),
      performanceTrend: trend,
      confidenceLevel: confidence,
      motivationalMessage: this.extractMotivationalMessage(analysis, userData)
    };
  }

  private extractStrengths(analysis: string, userData: UserPerformanceData): string[] {
    // Extract from analysis or fall back to known strong areas
    const strengthsSection = analysis.match(/strengths?[:\s]*([^.]*\.)/i);
    if (strengthsSection) {
      return strengthsSection[1].split(',').map(s => s.trim()).slice(0, 3);
    }
    return userData.strongAreas.slice(0, 2) || ['Consistent participation', 'Active engagement'];
  }

  private extractImprovementAreas(analysis: string, userData: UserPerformanceData): string[] {
    // Extract from analysis or fall back to known weak areas
    const improvementSection = analysis.match(/improvement[:\s]*([^.]*\.)/i);
    if (improvementSection) {
      const areas = improvementSection[1]
        .replace(/^areas?[:\s]*/i, '')  // Remove "areas:" prefix
        .split(/,|\band\b/)  // Split on comma or "and"
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, 3);
      return areas.length > 0 ? areas : ['Research team form', 'Consider match context'];
    }
    return (userData.weakAreas && userData.weakAreas.length > 0) 
      ? userData.weakAreas.slice(0, 2) 
      : ['Research team form', 'Consider match context'];
  }

  private extractMotivationalMessage(analysis: string, userData: UserPerformanceData): string {
    // Look for encouraging phrases in the analysis
    const encouragingLines = analysis.split('\n').filter(line => 
      line.toLowerCase().includes('keep') || 
      line.toLowerCase().includes('great') ||
      line.toLowerCase().includes('well done')
    );
    
    return encouragingLines[0]?.trim() || `Keep up the great work, ${userData.username}!`;
  }

  private calculateTrend(recentRounds: RoundPerformance[]): 'improving' | 'declining' | 'stable' | 'maintaining' {
    if (recentRounds.length < 2) return 'stable';
    
    const first = recentRounds[0].points;
    const last = recentRounds[recentRounds.length - 1].points;
    const diff = last - first;
    
    // Check overall pattern across all rounds
    const allScores = recentRounds.map(r => r.points);
    const isGenerallyHigh = allScores.every(score => score >= 10);
    
    if (diff > 3) return 'improving';
    if (diff < -3) return 'declining';
    if (isGenerallyHigh) return 'maintaining';
    
    // Check for poor performance trend (scores consistently low)
    const averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    if (averageScore < 5 && diff <= 0) return 'declining';
    
    return 'stable';
  }

  private calculateConfidenceLevel(userData: UserPerformanceData): 'low' | 'building' | 'moderate' | 'high' {
    if (userData.averagePoints > 10) return 'high';
    if (userData.averagePoints > 7) return 'moderate';
    if (userData.averagePoints > 4) return 'building';
    return 'low';
  }

  private parseSuggestions(suggestions: string): string[] {
    return suggestions.split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 5);
  }

  private getFallbackAnalysis(userData: UserPerformanceData): UserAnalysisResult {
    const trend = this.calculateTrend(userData.recentRounds);
    const confidence = this.calculateConfidenceLevel(userData);
    
    return {
      userId: userData.userId,
      summary: `${userData.username} has completed ${userData.totalRounds} rounds with ${userData.totalPoints} total points.`,
      strengths: (userData.strongAreas && userData.strongAreas.length > 0) ? userData.strongAreas.slice(0, 2) : ['Consistent participation', 'Active engagement'],
      improvementAreas: (userData.weakAreas && userData.weakAreas.length > 0) ? userData.weakAreas.slice(0, 2) : ['Analyze recent team form', 'Consider match context'],
      performanceTrend: trend,
      confidenceLevel: confidence,
      motivationalMessage: `Your analytical approach is developing well - keep it up, ${userData.username}!`
    };
  }

  private getFallbackSuggestions(userData: UserPerformanceData): string[] {
    const suggestions = [
      'Research team form and injury news',
      'Consider home advantage and recent head-to-head records',
      'Track your accuracy by match type to identify patterns'
    ];

    if (userData.weakAreas && userData.weakAreas.length > 0) {
      suggestions.push(`Focus on your identified weak areas: ${userData.weakAreas.join(', ')}`);
    }

    return suggestions;
  }

  private getFallbackMotivationalMessage(userData: UserPerformanceData): string {
    return `Keep up the great work, ${userData.username}! Your ${userData.totalPoints} points and position ${userData.rankPosition} show real dedication.`;
  }
}

export const userPerformanceAnalysisService = new UserPerformanceAnalysisService(); 