import 'server-only';

/**
 * Context interface for prompt generation (test compatibility)
 */
export interface PromptContext {
  // Match context
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  homeForm?: string;
  awayForm?: string;
  isCompleted?: boolean;
  
  // User context
  username?: string;
  totalPoints?: number;
  averagePoints?: number;
  ranking?: string;
  currentLevel?: string;
  weakAreas?: string[];
  recentPerformance?: string;
  
  // Email context
  emailType?: string;
  recipientName?: string;
  roundNumber?: number;
  
  // Generic properties
  [key: string]: unknown;
}

/**
 * Prompt configuration interface
 */
export interface PromptConfig {
  maxTokens: number;
  temperature: number;
}

/**
 * Prompt result interface
 */
export interface PromptResult {
  prompt: string;
  config: PromptConfig;
}

/**
 * Template parameters for different prompt types
 */
export interface PromptTemplateParams {
  // Story generation parameters
  roundNumber?: number;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  events?: Array<{ type: string; minute: number; player?: string }>;
  
  // User performance parameters
  username?: string;
  accuracy?: number;
  totalPoints?: number;
  rank?: number;
  totalParticipants?: number;
  
  // Match analysis parameters
  matchType?: 'completed' | 'upcoming';
  kickoff?: string;
  
  // Email content parameters
  emailType?: 'summary' | 'reminder';
  fixtures?: Array<{ homeTeam: string; awayTeam: string; kickoff: string }>;
  deadline?: string;
  
  // Custom parameters
  [key: string]: unknown;
}

/**
 * Prompt Template Service
 * Manages all AI prompt templates for consistent, optimized content generation
 */
export class PromptTemplateService {
  
  /**
   * Generate story prompts for different narrative types
   */
  generateStoryPrompt(type: 'title_race' | 'match_drama' | 'performance' | 'upset' | 'form', params: PromptTemplateParams): string {
    switch (type) {
      case 'title_race':
        return this.getTitleRacePrompt(params);
      case 'match_drama':
        return this.getMatchDramaPrompt(params);
      case 'performance':
        return this.getPerformanceStoryPrompt(params);
      case 'upset':
        return this.getUpsetStoryPrompt(params);
      case 'form':
        return this.getFormAnalysisPrompt(params);
      default:
        return this.getGenericStoryPrompt(params);
    }
  }

  /**
   * Generate email content prompts
   */
  generateEmailContentPrompt(type: 'summary' | 'reminder', params: PromptTemplateParams): string {
    switch (type) {
      case 'summary':
        return this.getSummaryEmailPrompt(params);
      case 'reminder':
        return this.getReminderEmailPrompt(params);
      default:
        return this.getGenericEmailPrompt(params);
    }
  }

  /**
   * Generate match analysis prompts
   */
  generateMatchAnalysisPrompt(type: 'single_match' | 'round_analysis' | 'prediction_insights', params: PromptTemplateParams): string {
    switch (type) {
      case 'single_match':
        return this.getSingleMatchAnalysisPrompt(params);
      case 'round_analysis':
        return this.getRoundAnalysisPrompt(params);
      case 'prediction_insights':
        return this.getPredictionInsightsPrompt(params);
      default:
        return this.getGenericAnalysisPrompt(params);
    }
  }

  /**
   * Generate user performance analysis prompts
   */
  generatePerformanceAnalysisPrompt(type: 'overall' | 'improvement' | 'motivation' | 'comparison', params: PromptTemplateParams): string {
    switch (type) {
      case 'overall':
        return this.getOverallPerformancePrompt(params);
      case 'improvement':
        return this.getImprovementSuggestionsPrompt(params);
      case 'motivation':
        return this.getMotivationPrompt(params);
      case 'comparison':
        return this.getComparisonPrompt(params);
      default:
        return this.getGenericPerformancePrompt(params);
    }
  }

  // Story prompt templates

  private getTitleRacePrompt(params: PromptTemplateParams): string {
    return `Write an engaging 2-3 sentence story about the league standings after Round ${params.roundNumber || 'X'}.

Focus on:
- The battle for first place
- How close/distant the race is
- Any dramatic position changes
- What this means for future rounds

Write in an exciting sports commentary style. Keep it concise, engaging, and suitable for an email. Don't use quotes or dialogue.`;
  }

  private getMatchDramaPrompt(params: PromptTemplateParams): string {
    const result = params.homeScore !== undefined && params.awayScore !== undefined 
      ? `${params.homeTeam} ${params.homeScore} - ${params.awayScore} ${params.awayTeam}`
      : `${params.homeTeam} vs ${params.awayTeam}`;

    return `Write a dramatic 2-3 sentence story about this exciting Premier League match from Round ${params.roundNumber || 'X'}:

Match: ${result}
${params.venue ? `Venue: ${params.venue}` : ''}

Write in an exciting sports journalism style, focusing on:
- The final result and what made it dramatic
- Key moments that shaped the game
- Why this match was memorable

Keep it engaging and suitable for an email newsletter. Don't use quotes.`;
  }

  private getPerformanceStoryPrompt(params: PromptTemplateParams): string {
    return `Write a personalized 2-3 sentence story about this user's prediction performance in Round ${params.roundNumber || 'X'}:

Player: ${params.username || 'Player'}
Accuracy: ${params.accuracy || 0}%
Points Earned: ${params.totalPoints || 0}

Write in an encouraging, personal tone that:
- Celebrates their successes this round
- Acknowledges their prediction accuracy
- Maintains a positive, motivational tone

Keep it personal and upbeat, suitable for an email. Use "you" to address them directly.`;
  }

  private getUpsetStoryPrompt(params: PromptTemplateParams): string {
    return `Write a dramatic 2-3 sentence story about this surprising Premier League result from Round ${params.roundNumber || 'X'}:

Upset Result: ${params.homeTeam} ${params.homeScore || 0} - ${params.awayScore || 0} ${params.awayTeam}

This was considered an upset because the underdog performed better than expected.

Write in an exciting sports journalism style focusing on:
- Why this result was surprising
- The significance of the upset
- The drama of the unexpected outcome

Keep it engaging and dramatic, suitable for an email newsletter.`;
  }

  private getFormAnalysisPrompt(params: PromptTemplateParams): string {
    return `Write a 2-3 sentence analysis of the overall trends from Round ${params.roundNumber || 'X'}:

Write in an analytical sports commentary style focusing on:
- Overall goal-scoring trends this round
- Whether it was a defensive or attacking round
- What this might mean for future prediction strategies

Keep it insightful and suitable for an email newsletter.`;
  }

  // Email content prompt templates

  private getSummaryEmailPrompt(params: PromptTemplateParams): string {
    return `Create engaging email content for a post-round summary email:

Round ${params.roundNumber || 'X'} Summary for ${params.username || 'User'}
Current Rank: ${params.rank || 'N/A'}/${params.totalParticipants || 'N/A'}
Points This Round: ${params.totalPoints || 0}

Create:
1. A warm, personalized greeting
2. Performance highlights for the round
3. Encouragement for future rounds

Tone: Friendly, engaging, and motivational
Length: 2-3 paragraphs
Style: Suitable for an email newsletter`;
  }

  private getReminderEmailPrompt(params: PromptTemplateParams): string {
    return `Create engaging reminder email content for upcoming fixtures:

Upcoming Deadline: ${params.deadline || 'Soon'}
User: ${params.username || 'Player'}

Create:
1. Friendly reminder about upcoming deadline
2. Brief preview of key fixtures
3. Motivational call-to-action

Tone: Encouraging, urgent but friendly
Length: 2-3 paragraphs
Style: Email newsletter format`;
  }

  // Match analysis prompt templates

  private getSingleMatchAnalysisPrompt(params: PromptTemplateParams): string {
    const isCompleted = params.matchType === 'completed';
    
    if (isCompleted) {
      return `Analyze this completed Premier League match:

${params.homeTeam} ${params.homeScore || 0} - ${params.awayScore || 0} ${params.awayTeam}

Provide:
1. A 2-sentence match summary
2. 2-3 key insights about the performance
3. Rate surprise factor (low/medium/high)
4. Rate prediction difficulty (easy/moderate/difficult)

Keep it concise and insightful.`;
    } else {
      return `Analyze this upcoming Premier League fixture for prediction purposes:

${params.homeTeam} vs ${params.awayTeam}
Kickoff: ${params.kickoff || 'TBD'}

Provide:
1. Brief preview (1-2 sentences)
2. Key factors to consider for predictions
3. Rate prediction difficulty (easy/moderate/difficult)

Focus on practical prediction insights.`;
    }
  }

  private getRoundAnalysisPrompt(params: PromptTemplateParams): string {
    return `Analyze Premier League Round ${params.roundNumber || 'X'} overall trends:

Provide:
1. Overall trends this round (2-3 sentences)
2. Notable performances (teams that stood out)
3. Surprise results
4. Key insights for future predictions

Keep analysis concise and focused on patterns.`;
  }

  private getPredictionInsightsPrompt(_params: PromptTemplateParams): string {
    return `Analyze these upcoming Premier League fixtures and provide 2-3 key prediction insights:

Focus on:
- Which matches look most predictable vs unpredictable
- Key tactical battles to watch
- Form trends that could affect outcomes
- Any potential upset opportunities

Keep insights practical for fantasy/prediction purposes, 2-3 sentences max.`;
  }

  // Performance analysis prompt templates

  private getOverallPerformancePrompt(params: PromptTemplateParams): string {
    return `Analyze this user's prediction performance and provide encouraging insights:

${params.username || 'Player'}:
- Accuracy: ${params.accuracy || 0}%
- Total Points: ${params.totalPoints || 0}
- Rank: ${params.rank || 'N/A'}/${params.totalParticipants || 'N/A'}

Provide:
1. Overall assessment (encouraging)
2. 2-3 strengths
3. 2-3 improvement suggestions
4. Motivational message

Keep it positive and constructive.`;
  }

  private getImprovementSuggestionsPrompt(params: PromptTemplateParams): string {
    return `Analyze this user's prediction patterns and suggest 3-4 specific improvements:

User: ${params.username || 'Player'}
Current Accuracy: ${params.accuracy || 0}%
Current Rank: ${params.rank || 'N/A'}/${params.totalParticipants || 'N/A'}

Provide specific, actionable improvement suggestions focusing on:
1. Prediction accuracy patterns
2. Strategic approaches to different match types
3. Areas where they're underperforming
4. Tactical advice for future rounds

Each suggestion should be 1-2 sentences and actionable.`;
  }

  private getMotivationPrompt(params: PromptTemplateParams): string {
    return `Write a personalized, motivational message for this prediction league participant:

${params.username || 'Player'}:
- Current accuracy: ${params.accuracy || 0}%
- Total points: ${params.totalPoints || 0}
- Rank: ${params.rank || 'N/A'}/${params.totalParticipants || 'N/A'}

Write a 2-3 sentence encouraging message that:
- Acknowledges their current performance
- Motivates them for upcoming fixtures
- Maintains a positive, supportive tone

Address them directly using "you" and keep it personal and upbeat.`;
  }

  private getComparisonPrompt(params: PromptTemplateParams): string {
    return `Compare this user's performance against league averages:

${params.username || 'Player'}:
- Accuracy: ${params.accuracy || 0}%
- Current rank: ${params.rank || 'N/A'}/${params.totalParticipants || 'N/A'}

Analyze:
1. What they do better than average
2. What they struggle with compared to others
3. How their ranking reflects their performance

Provide encouraging but honest assessment focusing on relative strengths and growth areas.
Keep it motivational and constructive.`;
  }

  // Generic fallback prompts

  private getGenericStoryPrompt(params: PromptTemplateParams): string {
    return `Write an engaging 2-3 sentence story about Premier League Round ${params.roundNumber || 'X'}.

Focus on creating an interesting narrative that would engage football fans.
Keep it suitable for an email newsletter format.`;
  }

  private getGenericEmailPrompt(params: PromptTemplateParams): string {
    return `Create engaging email content for ${params.username || 'the user'}.

Write in a friendly, personal tone suitable for an email newsletter.
Keep it encouraging and informative.`;
  }

  private getGenericAnalysisPrompt(_params: PromptTemplateParams): string {
    return `Provide analytical insights about Premier League matches and performance.

Focus on practical information that would help with predictions and understanding.
Keep it concise and informative.`;
  }

  private getGenericPerformancePrompt(params: PromptTemplateParams): string {
    return `Analyze user performance and provide constructive feedback for ${params.username || 'the user'}.

Focus on encouragement and practical improvement suggestions.
Keep it positive and motivational.`;
  }

  /**
   * Validate prompt parameters and provide defaults
   */
  validateAndFillParams(params: PromptTemplateParams): PromptTemplateParams {
    return {
      roundNumber: params.roundNumber || 1,
      username: params.username || 'Player',
      accuracy: params.accuracy || 0,
      totalPoints: params.totalPoints || 0,
      rank: params.rank || 1,
      totalParticipants: params.totalParticipants || 1,
      ...params
    };
  }

  /**
   * Get optimal AI generation settings for different prompt types
   */
  getOptimalSettings(promptType: string): { maxTokens: number; temperature: number } {
    switch (promptType) {
      case 'story':
        return { maxTokens: 200, temperature: 0.8 };
      case 'analysis':
        return { maxTokens: 300, temperature: 0.7 };
      case 'email':
        return { maxTokens: 250, temperature: 0.7 };
      case 'motivation':
        return { maxTokens: 150, temperature: 0.8 };
      default:
        return { maxTokens: 200, temperature: 0.7 };
    }
  }

  // Test-compatible methods that return { prompt, config } objects

  /**
   * Generate match story prompt (test compatible)
   */
  generateMatchStoryPrompt(context: PromptContext): PromptResult {
    const hasScores = context.homeScore !== undefined && context.awayScore !== undefined;
    const matchText = hasScores 
      ? `${context.homeTeam} vs ${context.awayTeam}\nFinal Score: ${context.homeScore}-${context.awayScore}`
      : `${context.homeTeam} vs ${context.awayTeam}`;

    const prompt = `Create an engaging match story for this Premier League fixture:

${matchText}

Write a compelling 2-3 sentence narrative that captures the drama and excitement of this match. Focus on key moments, standout performances, and the significance of the result.

Keep it engaging and suitable for a sports newsletter.`;

    return {
      prompt,
      config: { maxTokens: 300, temperature: 0.8 }
    };
  }

  /**
   * Generate user analysis prompt (test compatible)
   */
  generateUserAnalysisPrompt(context: PromptContext): PromptResult {
    const prompt = `Analyze the performance of ${context.username}:

Performance Summary:
- ${context.totalPoints} total points
- Average Points: ${context.averagePoints}
- Current Position: ${context.ranking}

Provide a comprehensive analysis covering:
1. Overall performance assessment
2. Key strengths in prediction accuracy
3. Areas for improvement
4. Encouragement for continued engagement

Tone: Professional but encouraging
Style: Analytical yet supportive`;

    return {
      prompt,
      config: { maxTokens: 400, temperature: 0.6 }
    };
  }

  /**
   * Generate email content prompt (test compatible)
   */
  generateEmailContentPromptForTest(context: PromptContext): PromptResult {
    const prompt = `Create email content for a Round ${context.roundNumber} Summary Email:

Recipient: ${context.recipientName}
Email Type: ${context.emailType}
Round: ${context.roundNumber}

Generate engaging email content that:
1. Greets the recipient personally
2. Provides relevant information for this email type
3. Maintains an enthusiastic, friendly tone
4. Encourages continued participation

Style: Newsletter format, conversational tone`;

    return {
      prompt,
      config: { maxTokens: 500, temperature: 0.7 }
    };
  }

  /**
   * Generate match analysis prompt (test compatible)
   */
  generateMatchAnalysisPromptForTest(context: PromptContext): PromptResult {
    let prompt = `Analyze this Premier League match:

${context.homeTeam} vs ${context.awayTeam}`;

    if (context.homeForm) {
      prompt += `\nHome Form: ${context.homeForm}`;
    }
    if (context.awayForm) {
      prompt += `\nAway Form: ${context.awayForm}`;
    }
    if (context.isCompleted && context.homeScore !== undefined && context.awayScore !== undefined) {
      prompt += `\nFinal Score: ${context.homeScore}-${context.awayScore}`;
    }

    prompt += `

Provide tactical analysis covering:
1. Key tactical factors affecting the match
2. Form analysis and recent trends
3. Prediction insights or post-match assessment
4. Notable performances or tactical decisions

Style: Professional football analysis`;

    return {
      prompt,
      config: { maxTokens: 300, temperature: 0.7 }
    };
  }

  /**
   * Generate improvement suggestions prompt (test compatible)
   */
  generateImprovementSuggestionsPrompt(context: PromptContext): PromptResult {
    const prompt = `Generate improvement suggestions for ${context.username}:

Current Performance Level: ${context.currentLevel} level
Average Points: ${context.averagePoints}
Weak Areas: ${context.weakAreas?.join(', ') || 'General improvement needed'}

Provide 3-5 specific, actionable suggestions to help improve prediction accuracy:
1. Focus on tactical analysis
2. Consider form and context
3. Research and preparation tips
4. Pattern recognition strategies
5. Risk management advice

Tone: Helpful and encouraging
Format: Clear, numbered suggestions`;

    return {
      prompt,
      config: { maxTokens: 350, temperature: 0.6 }
    };
  }

  /**
   * Generate motivational message prompt (test compatible)
   */
  generateMotivationalMessagePrompt(context: PromptContext): PromptResult {
    const prompt = `Create an encouraging motivational message for ${context.username}:

Recent Performance: ${context.recentPerformance}
Current Ranking: ${context.ranking}

Generate a personal, uplifting message that:
1. Acknowledges their recent ${context.recentPerformance} performance
2. Provides specific encouragement
3. Motivates continued participation
4. Maintains a positive, supportive tone

Keep it personal and under 100 words. Address them by name.`;

    return {
      prompt,
      config: { maxTokens: 200, temperature: 0.8 }
    };
  }

  private parsePromptTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(context[key] || match);
    });
  }
}

export const promptTemplateService = new PromptTemplateService(); 