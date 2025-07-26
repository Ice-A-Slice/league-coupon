import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';
import { getCronConfiguration, validateCronConfiguration, getNextExecutionTime } from '@/utils/cron/schedule';
import { getCronHealthSummary } from '@/utils/cron/alerts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/cron-status
 * 
 * Admin endpoint for monitoring cron job status, execution history, and health metrics.
 * Provides comprehensive insights into the automated season completion and winner 
 * determination system performance.
 * 
 * Authentication: Requires admin privileges (implement based on your auth system)
 * 
 * Returns:
 * - Current cron job configuration and validation status
 * - Recent execution history from logs
 * - Health metrics and next execution times
 * - System status and any detected issues
 */
export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    logger.info('Admin cron status check initiated', { timestamp });

    // TODO: Add authentication check here
    // Example: const user = await getUserFromRequest(request);
    // if (!user || !user.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createSupabaseServiceRoleClient();
    
    // Get cron configuration and validate it
    const cronConfig = getCronConfiguration();
    const configValidation = validateCronConfiguration(cronConfig);
    
    // Calculate next execution times
    const nextSeasonCompletion = getNextExecutionTime(cronConfig.seasonCompletion.schedule, cronConfig.seasonCompletion.timezone);
    const nextWinnerDetermination = getNextExecutionTime(cronConfig.winnerDetermination.schedule, cronConfig.winnerDetermination.timezone);
    
    // Get execution history from alerting system
    const executionHistory = getCronHealthSummary();
    
    // Get recent cron job execution data from application logs (last 7 days)
    // Note: In a production system, you might want to store this in a dedicated table
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Analyze recent season completion activity
    const { data: recentSeasons, error: seasonsError } = await supabase
      .from('seasons')
      .select('id, competition_id, name, completed_at, winner_determined_at')
      .gte('completed_at', sevenDaysAgo)
      .order('completed_at', { ascending: false });

    if (seasonsError) {
      logger.error('Failed to fetch recent season data for monitoring', { error: seasonsError });
    }

    // Analyze recent winner determination activity
    const { data: recentWinners, error: winnersError } = await supabase
      .from('season_winners')
      .select('id, season_id, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (winnersError) {
      logger.error('Failed to fetch recent winners data for monitoring', { error: winnersError });
    }

    // Calculate health metrics
    const completedSeasonsCount = recentSeasons?.length || 0;
    const determinedWinnersCount = recentWinners?.length || 0;
    
    // Check for potential issues
    const issues: string[] = [];
    
    if (!configValidation.isValid) {
      issues.push('Invalid cron configuration detected');
    }
    
    if (configValidation.warnings.length > 0) {
      issues.push(...configValidation.warnings);
    }

    // Check for seasons that completed but don't have winners determined
    const seasonsWithoutWinners = recentSeasons?.filter(season => 
      season.completed_at && !season.winner_determined_at
    ) || [];
    
    if (seasonsWithoutWinners.length > 0) {
      issues.push(`${seasonsWithoutWinners.length} completed seasons without determined winners`);
    }

    // Check if there are any seasons ready for completion (seasons that are current but not yet marked as completed)
    const { data: potentiallyCompletedSeasons, error: potentialError } = await supabase
      .from('seasons')
      .select('id, competition_id, name, end_date, is_current')
      .eq('is_current', true)
      .is('completed_at', null)
      .not('end_date', 'is', null);
    
    if (potentialError) {
      logger.warn('Failed to check for potentially completed seasons', { error: potentialError });
    }

    const systemStatus = issues.length === 0 ? 'healthy' : 'warning';
    
    const healthMetrics = {
      systemStatus,
      lastCheckTime: timestamp,
      recentActivity: {
        completedSeasons: completedSeasonsCount,
        determinedWinners: determinedWinnersCount,
        seasonsWithoutWinners: seasonsWithoutWinners.length,
        potentiallyReadySeasons: potentiallyCompletedSeasons?.length || 0
      },
      configuration: {
        isValid: configValidation.isValid,
        seasonCompletion: {
          schedule: cronConfig.seasonCompletion.schedule,
          timezone: cronConfig.seasonCompletion.timezone,
          enabled: cronConfig.seasonCompletion.enabled,
          nextExecution: nextSeasonCompletion.toISOString()
        },
        winnerDetermination: {
          schedule: cronConfig.winnerDetermination.schedule,
          timezone: cronConfig.winnerDetermination.timezone,
          enabled: cronConfig.winnerDetermination.enabled,
          nextExecution: nextWinnerDetermination.toISOString()
        }
      },
      issues,
      configValidation
    };

    const executionTime = Date.now() - startTime;
    
    logger.info('Admin cron status check completed', { 
      executionTimeMs: executionTime,
      systemStatus,
      issuesCount: issues.length,
      timestamp 
    });

    return NextResponse.json({
      success: true,
      data: healthMetrics,
      executionHistory,
      recentSeasons: recentSeasons || [],
      recentWinners: recentWinners || [],
      meta: {
        executionTimeMs: executionTime,
        timestamp,
        dataRange: {
          from: sevenDaysAgo,
          to: timestamp
        }
      }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Admin cron status check failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: executionTime,
      timestamp
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve cron status',
      details: error instanceof Error ? error.message : String(error),
      meta: {
        executionTimeMs: executionTime,
        timestamp
      }
    }, { status: 500 });
  }
} 