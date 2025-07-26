import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
import { logger } from '@/utils/logger';
import { getCronConfiguration, validateCronConfiguration } from '@/utils/cron/schedule';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/cron
 * 
 * Health check endpoint for cron job system verification.
 * Performs comprehensive checks to ensure all cron job dependencies
 * and configurations are working correctly.
 * 
 * Used by monitoring systems to verify system health.
 * 
 * Returns:
 * - Overall health status (healthy/degraded/unhealthy)
 * - Individual component health checks
 * - Detailed diagnostics for any failures
 */
export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    logger.info('Cron health check initiated', { timestamp });

    const checks = {
      database: await checkDatabaseConnection(),
      configuration: await checkCronConfiguration(),
      services: await checkCronServices(),
      environment: await checkEnvironmentVariables()
    };

    // Determine overall health status
    const failedChecks = Object.entries(checks).filter(([, check]) => check.status !== 'healthy');
    const degradedChecks = Object.entries(checks).filter(([, check]) => check.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedChecks.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const executionTime = Date.now() - startTime;
    
    logger.info('Cron health check completed', { 
      overallStatus,
      executionTimeMs: executionTime,
      failedChecks: failedChecks.length,
      timestamp 
    });

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json({
      status: overallStatus,
      timestamp,
      checks,
      meta: {
        executionTimeMs: executionTime,
        version: process.env.npm_package_version || 'unknown'
      }
    }, { status: statusCode });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Cron health check failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      executionTimeMs: executionTime,
      timestamp
    });

    return NextResponse.json({
      status: 'unhealthy',
      timestamp,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error),
      meta: {
        executionTimeMs: executionTime
      }
    }, { status: 503 });
  }
}

/**
 * Check database connectivity and table access
 */
async function checkDatabaseConnection() {
  try {
    const supabase = createSupabaseServiceRoleClient();
    
    // Test basic connectivity
    const { error: connectionError } = await supabase
      .from('seasons')
      .select('count')
      .limit(1);
    
    if (connectionError) {
      return {
        status: 'unhealthy' as const,
        message: 'Database connection failed',
        error: connectionError.message,
        timestamp: new Date().toISOString()
      };
    }

    // Test season_winners table access
    const { error: winnersError } = await supabase
      .from('season_winners')
      .select('count')
      .limit(1);
    
    if (winnersError) {
      return {
        status: 'degraded' as const,
        message: 'Season winners table access failed',
        error: winnersError.message,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy' as const,
      message: 'Database connectivity verified',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      status: 'unhealthy' as const,
      message: 'Database health check failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check cron configuration validity
 */
async function checkCronConfiguration() {
  try {
    const config = getCronConfiguration();
    const validation = validateCronConfiguration(config);
    
    if (!validation.isValid) {
      return {
        status: 'unhealthy' as const,
        message: 'Invalid cron configuration',
        errors: validation.errors,
        warnings: validation.warnings,
        timestamp: new Date().toISOString()
      };
    }

    if (validation.warnings.length > 0) {
      return {
        status: 'degraded' as const,
        message: 'Cron configuration has warnings',
        warnings: validation.warnings,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy' as const,
      message: 'Cron configuration valid',
      config: {
        seasonCompletion: {
          schedule: config.seasonCompletion.schedule,
          enabled: config.seasonCompletion.enabled,
          timezone: config.seasonCompletion.timezone
        },
        winnerDetermination: {
          schedule: config.winnerDetermination.schedule,
          enabled: config.winnerDetermination.enabled,
          timezone: config.winnerDetermination.timezone
        }
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      status: 'unhealthy' as const,
      message: 'Configuration check failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check cron service dependencies
 */
async function checkCronServices() {
  try {
    // Test if cron endpoints are accessible (basic check)
    const services = {
      seasonCompletion: '/api/cron/season-completion',
      winnerDetermination: '/api/cron/winner-determination'
    };

    // In a real implementation, you might make internal requests to test endpoints
    // For now, we'll just verify the required environment variables exist
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      return {
        status: 'unhealthy' as const,
        message: 'CRON_SECRET environment variable not configured',
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy' as const,
      message: 'Cron services configuration verified',
      services,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      status: 'unhealthy' as const,
      message: 'Service check failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check required environment variables
 */
async function checkEnvironmentVariables() {
  try {
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'];
    const optionalVars = ['SEASON_COMPLETION_SCHEDULE', 'WINNER_DETERMINATION_SCHEDULE', 'CRON_TIMEZONE'];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    const present = optionalVars.filter(varName => process.env[varName]);
    
    if (missing.length > 0) {
      return {
        status: 'unhealthy' as const,
        message: 'Required environment variables missing',
        missing,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy' as const,
      message: 'Environment variables configured',
      required: requiredVars.length,
      optional: present.length,
      customConfigurations: present,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      status: 'unhealthy' as const,
      message: 'Environment check failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
} 