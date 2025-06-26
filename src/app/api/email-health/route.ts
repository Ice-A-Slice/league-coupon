import { NextResponse } from 'next/server';
import { emailMonitoringService } from '@/lib/emailMonitoringService';

/**
 * GET /api/email-health
 * 
 * Health check endpoint for email system monitoring.
 * Returns system health status, recent metrics, and performance insights.
 */
export async function GET() {
  try {
    // Get comprehensive health data
    const systemHealth = emailMonitoringService.getSystemHealth();
    
    // Get recent performance insights
    const performanceInsights = await emailMonitoringService.getPerformanceInsights('24h');
    
    const response = {
      timestamp: new Date().toISOString(),
      status: systemHealth.status,
      health: {
        system_status: systemHealth.status,
        current_operations: systemHealth.current_operations,
        recent_errors: systemHealth.recent_errors,
        success_rate_24h: systemHealth.success_rate_24h,
        avg_response_time: systemHealth.avg_response_time,
        recommendations: systemHealth.recommendations
      },
      performance: {
        timeframe: performanceInsights.timeframe,
        metrics: {
          total_operations: performanceInsights.total_operations,
          total_emails_sent: performanceInsights.total_emails_sent,
          total_errors: performanceInsights.total_errors,
          success_rate: performanceInsights.success_rate.toFixed(1) + '%',
          avg_duration_per_operation: (performanceInsights.avg_duration_per_operation / 1000).toFixed(1) + 's',
          avg_emails_per_operation: performanceInsights.avg_emails_per_operation.toFixed(1)
        },
        errors: {
          most_common_errors: performanceInsights.most_common_errors
        },
        slowest_operations: performanceInsights.slowest_operations
      }
    };
    
    // Return appropriate status code based on health
    const statusCode = systemHealth.status === 'healthy' ? 200 : 
                      systemHealth.status === 'degraded' ? 206 : 503;
    
    return NextResponse.json(response, { status: statusCode });
    
  } catch (error) {
    console.error('Error getting email health status:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'error',
      message: 'Failed to retrieve email system health status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/email-health
 * 
 * Get performance insights for a specific timeframe.
 * Accepts: { timeframe: '1h' | '24h' | '7d' | '30d' }
 */
export async function POST(request: Request) {
  try {
    const { timeframe } = await request.json();
    
    if (!timeframe || !['1h', '24h', '7d', '30d'].includes(timeframe)) {
      return NextResponse.json({
        error: 'Invalid timeframe. Must be one of: 1h, 24h, 7d, 30d'
      }, { status: 400 });
    }
    
    const insights = await emailMonitoringService.getPerformanceInsights(timeframe);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      insights
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error getting performance insights:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve performance insights',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 