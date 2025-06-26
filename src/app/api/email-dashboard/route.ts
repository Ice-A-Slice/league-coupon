import { NextResponse } from 'next/server';
import { healthCheckService } from '@/lib/healthCheckService';
import { errorTrackingService } from '@/lib/errorTrackingService';
import { emailMonitoringService } from '@/lib/emailMonitoringService';
import { logger } from '@/utils/logger';

/**
 * GET /api/email-dashboard - Comprehensive email system dashboard data
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeWindow = parseInt(searchParams.get('timeWindow') || '24');
  const includeHealth = searchParams.get('includeHealth') !== 'false';
  const includeErrors = searchParams.get('includeErrors') !== 'false';
  const includeMetrics = searchParams.get('includeMetrics') !== 'false';
  const format = searchParams.get('format') || 'json';

  try {
    const dashboardData: {
      timestamp: string;
      timeWindow: number;
      health?: unknown;
      errors?: unknown;
      metrics?: unknown;
      summary?: {
        overallStatus: string;
        criticalIssues: number;
        totalErrors: number;
        emailsSent: number;
        successRate: number;
        avgResponseTime: number;
      };
    } = {
      timestamp: new Date().toISOString(),
      timeWindow
    };

    // Collect health data
    if (includeHealth) {
      try {
        dashboardData.health = await healthCheckService.checkSystemHealth();
      } catch (error) {
        logger.error('Failed to get health data for dashboard', { error });
        dashboardData.health = {
          status: 'unknown',
          message: 'Health check failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Collect error data
    if (includeErrors) {
      try {
        const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000).toISOString();
        dashboardData.errors = {
          recent: errorTrackingService.getErrors({ since, limit: 20 }),
          stats: errorTrackingService.getErrorStats(timeWindow)
        };
      } catch (error) {
        logger.error('Failed to get error data for dashboard', { error });
        dashboardData.errors = {
          recent: [],
          stats: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Collect email metrics
    if (includeMetrics) {
      try {
        dashboardData.metrics = {
          systemHealth: emailMonitoringService.getSystemHealth(),
          performanceInsights: await emailMonitoringService.getPerformanceInsights('24h'),
          recentOperations: emailMonitoringService.getAllOperations().slice(0, 20)
        };
      } catch (error) {
        logger.error('Failed to get email metrics for dashboard', { error });
        dashboardData.metrics = {
          summary: null,
          performance: null,
          recent: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Generate summary for quick overview
    dashboardData.summary = generateDashboardSummary(dashboardData);

    // Return formatted response
    if (format === 'summary') {
      return NextResponse.json({
        status: dashboardData.summary?.overallStatus || 'unknown',
        summary: dashboardData.summary,
        timestamp: dashboardData.timestamp
      });
    }

    return NextResponse.json(dashboardData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Dashboard data collection failed';
    
    logger.error('Email dashboard endpoint failed', {
      error: errorMessage,
      timeWindow,
      includeHealth,
      includeErrors,
      includeMetrics
    });

    return NextResponse.json({
      error: 'Dashboard data collection failed',
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Generate a high-level summary of system status
 */
function generateDashboardSummary(data: {
  health?: unknown;
  errors?: unknown;
  metrics?: unknown;
}): {
  overallStatus: string;
  criticalIssues: number;
  totalErrors: number;
  emailsSent: number;
  successRate: number;
  avgResponseTime: number;
} {
  // Determine overall status
  let overallStatus = 'healthy';
  
  if (data.health && typeof data.health === 'object' && 'status' in data.health) {
    const healthStatus = data.health.status;
    if (healthStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (healthStatus === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  }

  // Extract key metrics with safe type checking
  const criticalIssues = (data.health && typeof data.health === 'object' && 'summary' in data.health && 
    data.health.summary && typeof data.health.summary === 'object' && 'critical_issues' in data.health.summary) 
    ? Number(data.health.summary.critical_issues) || 0 
    : 0;

  const totalErrors = (data.errors && typeof data.errors === 'object' && 'stats' in data.errors && 
    data.errors.stats && typeof data.errors.stats === 'object' && 'unresolved' in data.errors.stats)
    ? Number(data.errors.stats.unresolved) || 0
    : 0;

  // Extract email metrics from system health and performance insights
  const emailsSent = (data.metrics && typeof data.metrics === 'object' && 'performanceInsights' in data.metrics && 
    data.metrics.performanceInsights && typeof data.metrics.performanceInsights === 'object' && 'total_emails_sent' in data.metrics.performanceInsights)
    ? Number(data.metrics.performanceInsights.total_emails_sent) || 0
    : 0;

  const successRate = (data.metrics && typeof data.metrics === 'object' && 'systemHealth' in data.metrics && 
    data.metrics.systemHealth && typeof data.metrics.systemHealth === 'object' && 'success_rate_24h' in data.metrics.systemHealth)
    ? Number(data.metrics.systemHealth.success_rate_24h) || 0
    : 0;

  const avgResponseTime = (data.metrics && typeof data.metrics === 'object' && 'systemHealth' in data.metrics && 
    data.metrics.systemHealth && typeof data.metrics.systemHealth === 'object' && 'avg_response_time' in data.metrics.systemHealth)
    ? Number(data.metrics.systemHealth.avg_response_time) || 0
    : 0;

  return {
    overallStatus,
    criticalIssues,
    totalErrors,
    emailsSent,
    successRate,
    avgResponseTime
  };
}

/**
 * POST /api/email-dashboard - Trigger dashboard data refresh or actions
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'refresh':
        logger.info('Dashboard data refresh requested');
        return NextResponse.json({
          action: 'refresh',
          status: 'completed',
          timestamp: new Date().toISOString()
        });

      case 'test-health':
        const healthResult = await healthCheckService.getQuickHealthStatus();
        return NextResponse.json({
          action: 'test-health',
          status: 'completed',
          result: healthResult,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['refresh', 'test-health']
        }, { status: 400 });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Dashboard action failed';
    logger.error('Email dashboard action failed', { error: errorMessage });
    return NextResponse.json({
      error: 'Dashboard action failed',
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
