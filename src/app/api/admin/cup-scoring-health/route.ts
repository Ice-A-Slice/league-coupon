import { NextResponse } from 'next/server';
import { cupScoringMonitoringService } from '@/lib/cupScoringMonitoringService';
import { logger } from '@/utils/logger';

interface DashboardData {
  timestamp: string;
  status: string;
  timeframe: string;
  health: {
    system_status: string;
    current_operations: number;
    recent_errors: number;
    success_rate_24h: number;
    avg_response_time: number;
    total_points_awarded_24h: number;
    total_users_processed_24h: number;
    recommendations: string[];
  };
  performance: {
    timeframe: string;
    metrics: {
      total_operations: number;
      total_users_processed: number;
      total_points_awarded: number;
      total_errors: number;
      success_rate: string;
      avg_duration_per_operation: string;
      avg_users_per_operation: string;
      avg_points_per_operation: string;
    };
    errors: {
      most_common_errors: Array<{ category: string; count: number }>;
    };
    slowest_operations: Array<{ id: string; duration: string; type: string }>;
  };
  operations?: {
    recent: Array<{
      id: string;
      type: string;
      status: string;
      seasonId: number | null;
      bettingRoundId: number | null;
      usersProcessed: number;
      roundsProcessed: number;
      totalPointsAwarded: number;
      duration: string | null;
      errorCount: number;
      startTime: string;
      endTime: string | null;
    }>;
    by_status: {
      pending: number;
      in_progress: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
  };
  errors?: {
    recent: Array<{
      id: string;
      operationId: string;
      operationType: string;
      category: string;
      message: string;
      severity: string;
      timestamp: string;
      userId?: string;
      bettingRoundId?: number;
      fixtureId?: number;
      context?: Record<string, unknown>;
    }>;
    by_category: Array<{ category: string; count: number }>;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  summary?: {
    overallStatus: string;
    activeOperations: number;
    successRate: string;
    totalOperations: number;
    totalUsersProcessed: number;
    totalPointsAwarded: number;
    avgResponseTime: string;
    errorRate: string;
    recommendations: string[];
  };
}

/**
 * GET /api/admin/cup-scoring-health
 * 
 * Health check and monitoring endpoint for cup scoring system.
 * Returns system health status, recent metrics, and performance insights.
 * 
 * Query parameters:
 * - timeframe: '1h' | '24h' | '7d' | '30d' (default: '24h')
 * - includeOperations: 'true' | 'false' (default: 'false')
 * - includeErrors: 'true' | 'false' (default: 'true')
 * - format: 'full' | 'summary' (default: 'full')
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get('timeframe') as '1h' | '24h' | '7d' | '30d') || '24h';
    const includeOperations = searchParams.get('includeOperations') === 'true';
    const includeErrors = searchParams.get('includeErrors') !== 'false'; // default true
    const format = searchParams.get('format') === 'summary' ? 'summary' : 'full';

    // Validate timeframe
    if (!['1h', '24h', '7d', '30d'].includes(timeframe)) {
      return NextResponse.json({
        error: 'Invalid timeframe. Must be one of: 1h, 24h, 7d, 30d'
      }, { status: 400 });
    }

    logger.info('Cup scoring health check requested', {
      timeframe,
      includeOperations,
      includeErrors,
      format
    });

    // Get system health
    const systemHealth = cupScoringMonitoringService.getSystemHealth();
    
    // Get performance insights for the requested timeframe
    const performanceInsights = await cupScoringMonitoringService.getPerformanceInsights(timeframe);
    
    // Collect additional data based on parameters
    const dashboardData: DashboardData = {
      timestamp: new Date().toISOString(),
      status: systemHealth.status,
      timeframe,
      health: {
        system_status: systemHealth.status,
        current_operations: systemHealth.current_operations,
        recent_errors: systemHealth.recent_errors,
        success_rate_24h: systemHealth.success_rate_24h,
        avg_response_time: systemHealth.avg_response_time,
        total_points_awarded_24h: systemHealth.total_points_awarded_24h,
        total_users_processed_24h: systemHealth.total_users_processed_24h,
        recommendations: systemHealth.recommendations
      },
      performance: {
        timeframe: performanceInsights.timeframe,
        metrics: {
          total_operations: performanceInsights.total_operations,
          total_users_processed: performanceInsights.total_users_processed,
          total_points_awarded: performanceInsights.total_points_awarded,
          total_errors: performanceInsights.total_errors,
          success_rate: performanceInsights.success_rate.toFixed(1) + '%',
          avg_duration_per_operation: (performanceInsights.avg_duration_per_operation / 1000).toFixed(1) + 's',
          avg_users_per_operation: performanceInsights.avg_users_per_operation.toFixed(1),
          avg_points_per_operation: performanceInsights.avg_points_per_operation.toFixed(1)
        },
        errors: {
          most_common_errors: performanceInsights.most_common_errors
        },
        slowest_operations: performanceInsights.slowest_operations.map(op => ({
          ...op,
          duration: (op.duration / 1000).toFixed(1) + 's'
        }))
      }
    };

    // Include recent operations if requested
    if (includeOperations) {
      const allOperations = cupScoringMonitoringService.getAllOperations();
      dashboardData.operations = {
        recent: allOperations.slice(0, 20).map(op => ({
          id: op.id,
          type: op.type,
          status: op.status,
          seasonId: op.seasonId,
          bettingRoundId: op.bettingRoundId,
          usersProcessed: op.usersProcessed,
          roundsProcessed: op.roundsProcessed,
          totalPointsAwarded: op.totalPointsAwarded,
          duration: op.duration ? (op.duration / 1000).toFixed(1) + 's' : null,
          errorCount: op.errors.length,
          startTime: new Date(op.startTime).toISOString(),
          endTime: op.endTime ? new Date(op.endTime).toISOString() : null
        })),
        by_status: {
          pending: cupScoringMonitoringService.getOperationsByStatus('pending').length,
          in_progress: cupScoringMonitoringService.getOperationsByStatus('in_progress').length,
          completed: cupScoringMonitoringService.getOperationsByStatus('completed').length,
          failed: cupScoringMonitoringService.getOperationsByStatus('failed').length,
          cancelled: cupScoringMonitoringService.getOperationsByStatus('cancelled').length
        }
      };
    }

    // Include detailed error information if requested
    if (includeErrors) {
      const allOperations = cupScoringMonitoringService.getAllOperations();
      const allErrors = allOperations.flatMap(op => 
        op.errors.map(error => ({
          id: error.id,
          operationId: op.id,
          operationType: op.type,
          category: error.category,
          message: error.message,
          severity: error.severity,
          timestamp: new Date(error.timestamp).toISOString(),
          userId: error.userId,
          bettingRoundId: error.bettingRoundId,
          fixtureId: error.fixtureId,
          context: error.context
        }))
      );

      // Get recent errors (last 24 hours)
      const last24h = Date.now() - (24 * 60 * 60 * 1000);
      const recentErrors = allErrors.filter(error => 
        new Date(error.timestamp).getTime() >= last24h
      );

      dashboardData.errors = {
        recent: recentErrors.slice(0, 50), // Latest 50 errors
        by_category: performanceInsights.most_common_errors,
        by_severity: {
          critical: recentErrors.filter(e => e.severity === 'critical').length,
          high: recentErrors.filter(e => e.severity === 'high').length,
          medium: recentErrors.filter(e => e.severity === 'medium').length,
          low: recentErrors.filter(e => e.severity === 'low').length
        }
      };
    }

    // Generate summary for quick overview
    dashboardData.summary = {
      overallStatus: systemHealth.status,
      activeOperations: systemHealth.current_operations,
      successRate: performanceInsights.success_rate.toFixed(1) + '%',
      totalOperations: performanceInsights.total_operations,
      totalUsersProcessed: performanceInsights.total_users_processed,
      totalPointsAwarded: performanceInsights.total_points_awarded,
      avgResponseTime: (performanceInsights.avg_duration_per_operation / 1000).toFixed(1) + 's',
      errorRate: performanceInsights.total_operations > 0 
        ? ((performanceInsights.total_errors / performanceInsights.total_operations) * 100).toFixed(1) + '%'
        : '0%',
      recommendations: systemHealth.recommendations
    };

    // Return appropriate response based on format
    if (format === 'summary') {
      return NextResponse.json({
        status: dashboardData.summary.overallStatus,
        summary: dashboardData.summary,
        timestamp: dashboardData.timestamp
      });
    }

    // Return appropriate status code based on health
    const statusCode = systemHealth.status === 'healthy' ? 200 : 
                      systemHealth.status === 'degraded' ? 206 : 503;

    return NextResponse.json(dashboardData, { status: statusCode });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Cup scoring health check failed';
    
    logger.error('Cup scoring health endpoint failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Cup scoring health check failed',
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/cup-scoring-health
 * 
 * Get detailed performance insights for a specific timeframe or operation.
 * Accepts: { 
 *   timeframe?: '1h' | '24h' | '7d' | '30d',
 *   operationId?: string,
 *   operationType?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { timeframe, operationId, operationType } = body;

    logger.info('Cup scoring detailed insights requested', {
      timeframe,
      operationId,
      operationType
    });

    if (operationId) {
      // Get specific operation details
      const operation = cupScoringMonitoringService.getOperation(operationId);
      if (!operation) {
        return NextResponse.json({
          error: 'Operation not found',
          operationId
        }, { status: 404 });
      }

      const metrics = cupScoringMonitoringService.getOperationMetrics(operationId);
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        operation: {
          ...operation,
          startTime: new Date(operation.startTime).toISOString(),
          endTime: operation.endTime ? new Date(operation.endTime).toISOString() : null,
          duration: operation.duration ? (operation.duration / 1000).toFixed(1) + 's' : null,
          errors: operation.errors.map(error => ({
            ...error,
            timestamp: new Date(error.timestamp).toISOString()
          }))
        },
        metrics: metrics ? {
          ...metrics,
          totalDuration: (metrics.totalDuration / 1000).toFixed(1) + 's',
          averageTimePerUser: (metrics.averageTimePerUser / 1000).toFixed(3) + 's',
          averageTimePerRound: (metrics.averageTimePerRound / 1000).toFixed(1) + 's',
          usersPerSecond: metrics.usersPerSecond.toFixed(2),
          pointsAwardedPerSecond: metrics.pointsAwardedPerSecond.toFixed(2),
          averagePointsPerUser: metrics.averagePointsPerUser.toFixed(1),
          successRate: metrics.successRate.toFixed(1) + '%'
        } : null
      });
    }

    if (operationType) {
      // Get operations by type
      const operations = cupScoringMonitoringService.getAllOperations()
        .filter(op => op.type === operationType)
        .slice(0, 50);

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        operationType,
        operations: operations.map(op => ({
          id: op.id,
          status: op.status,
          seasonId: op.seasonId,
          bettingRoundId: op.bettingRoundId,
          usersProcessed: op.usersProcessed,
          roundsProcessed: op.roundsProcessed,
          totalPointsAwarded: op.totalPointsAwarded,
          duration: op.duration ? (op.duration / 1000).toFixed(1) + 's' : null,
          errorCount: op.errors.length,
          startTime: new Date(op.startTime).toISOString(),
          endTime: op.endTime ? new Date(op.endTime).toISOString() : null
        }))
      });
    }

    if (timeframe && ['1h', '24h', '7d', '30d'].includes(timeframe)) {
      // Get performance insights for timeframe
      const insights = await cupScoringMonitoringService.getPerformanceInsights(timeframe);
      
      return NextResponse.json({
        timestamp: new Date().toISOString(),
        insights: {
          ...insights,
          avg_duration_per_operation: (insights.avg_duration_per_operation / 1000).toFixed(1) + 's',
          slowest_operations: insights.slowest_operations.map(op => ({
            ...op,
            duration: (op.duration / 1000).toFixed(1) + 's'
          }))
        }
      });
    }

    return NextResponse.json({
      error: 'Invalid request. Provide timeframe, operationId, or operationType'
    }, { status: 400 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Cup scoring insights request failed';
    
    logger.error('Cup scoring insights endpoint failed', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Cup scoring insights request failed',
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 