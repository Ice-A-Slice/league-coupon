import { NextResponse } from 'next/server';
import { healthCheckService } from '@/lib/healthCheckService';
import { logger } from '@/utils/logger';

/**
 * GET /api/health - System health check endpoint
 * 
 * Query parameters:
 * - quick: boolean - If true, performs a quick health check (default: false)
 * - format: 'json' | 'text' - Response format (default: 'json')
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isQuick = searchParams.get('quick') === 'true';
  const format = searchParams.get('format') || 'json';

  try {
    if (isQuick) {
      // Quick health check for load balancers/uptime monitoring
      const quickStatus = await healthCheckService.getQuickHealthStatus();
      
      if (format === 'text') {
        return new Response(quickStatus.message, {
          status: quickStatus.status === 'healthy' ? 200 : 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      return NextResponse.json(quickStatus, {
        status: quickStatus.status === 'healthy' ? 200 : 503
      });
    }

    // Comprehensive health check
    const systemHealth = await healthCheckService.checkSystemHealth();
    
    // Determine HTTP status code based on system health
    let statusCode = 200;
    switch (systemHealth.status) {
      case 'unhealthy':
        statusCode = 503; // Service Unavailable
        break;
      case 'degraded':
        statusCode = 200; // OK but with warnings
        break;
      case 'healthy':
        statusCode = 200; // OK
        break;
      default:
        statusCode = 503; // Unknown status treated as unhealthy
    }

    if (format === 'text') {
      const textStatus = formatHealthAsText(systemHealth);
      return new Response(textStatus, {
        status: statusCode,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return NextResponse.json(systemHealth, { status: statusCode });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    
    logger.error('Health check endpoint failed', {
      error: errorMessage,
      isQuick,
      format
    });

    if (format === 'text') {
      return new Response(`UNHEALTHY: ${errorMessage}`, {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return NextResponse.json({
      status: 'unhealthy',
      message: 'Health check service failed',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}

/**
 * Format system health as plain text for simple monitoring
 */
function formatHealthAsText(health: { status: string; timestamp: string; uptime: number; environment: string; version: string; components: Array<{ name: string; status: string; critical: boolean; message: string; responseTime: number }>; summary: { total: number; healthy: number; degraded: number; unhealthy: number; critical_issues: number } }): string {
  const lines = [
    `Status: ${health.status.toUpperCase()}`,
    `Timestamp: ${health.timestamp}`,
    `Uptime: ${health.uptime}s`,
    `Environment: ${health.environment}`,
    `Version: ${health.version}`,
    '',
    'Components:',
  ];

  for (const component of health.components) {
    const status = component.status.toUpperCase();
    const critical = component.critical ? ' (CRITICAL)' : '';
    const responseTime = `${component.responseTime}ms`;
    
    lines.push(`  ${component.name}: ${status}${critical} - ${component.message} (${responseTime})`);
  }

  lines.push('');
  lines.push('Summary:');
  lines.push(`  Total: ${health.summary.total}`);
  lines.push(`  Healthy: ${health.summary.healthy}`);
  lines.push(`  Degraded: ${health.summary.degraded}`);
  lines.push(`  Unhealthy: ${health.summary.unhealthy}`);
  lines.push(`  Critical Issues: ${health.summary.critical_issues}`);

  return lines.join('\n');
} 