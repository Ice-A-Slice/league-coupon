import { logger } from '@/utils/logger';
import { createServerClient } from '@supabase/ssr';
import { trackError } from './errorTrackingService';

/**
 * Health check status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Individual component health check result
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  responseTime: number; // in milliseconds
  message: string;
  details?: Record<string, unknown>;
  lastChecked: string;
  critical: boolean; // Whether this component is critical for system operation
}

/**
 * Overall system health report
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: string;
  uptime: number; // in seconds
  version: string;
  environment: string;
  components: ComponentHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_issues: number;
  };
}

/**
 * Health check configuration for each component
 */
interface HealthCheckConfig {
  name: string;
  critical: boolean;
  timeout: number; // in milliseconds
  check: () => Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }>;
}

/**
 * Comprehensive health check service for monitoring system components
 */
class HealthCheckService {
  private readonly startTime = Date.now();
  private readonly version = process.env.npm_package_version || '1.0.0';
  private readonly environment = process.env.NODE_ENV || 'development';
  
  private healthChecks: HealthCheckConfig[] = [];

  constructor() {
    this.initializeHealthChecks();
  }

  /**
   * Initialize all health check configurations
   */
  private initializeHealthChecks(): void {
    this.healthChecks = [
      {
        name: 'database',
        critical: true,
        timeout: 5000,
        check: this.checkDatabase.bind(this)
      },
      {
        name: 'email_service',
        critical: true,
        timeout: 3000,
        check: this.checkEmailService.bind(this)
      },
      {
        name: 'football_api',
        critical: false,
        timeout: 10000,
        check: this.checkFootballAPI.bind(this)
      },
      {
        name: 'memory_usage',
        critical: false,
        timeout: 1000,
        check: this.checkMemoryUsage.bind(this)
      },
      {
        name: 'disk_space',
        critical: false,
        timeout: 1000,
        check: this.checkDiskSpace.bind(this)
      },
      {
        name: 'environment_variables',
        critical: true,
        timeout: 500,
        check: this.checkEnvironmentVariables.bind(this)
      },
      {
        name: 'essential_data',
        critical: true,
        timeout: 3000,
        check: this.checkEssentialData.bind(this)
      }
    ];
  }

  /**
   * Perform comprehensive system health check
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    logger.info('Starting comprehensive system health check');
    const timestamp = new Date().toISOString();
    const components: ComponentHealth[] = [];

    // Run all health checks in parallel
    const healthCheckPromises = this.healthChecks.map(async (config) => {
      const startTime = Date.now();
      
      try {
        // Add timeout to each health check
        const checkPromise = config.check();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
        });

        const result = await Promise.race([checkPromise, timeoutPromise]);
        const responseTime = Date.now() - startTime;

        return {
          name: config.name,
          status: result.status,
          responseTime,
          message: result.message,
          details: result.details,
          lastChecked: new Date().toISOString(),
          critical: config.critical
        } as ComponentHealth;

      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Track the health check failure
        trackError(
          `Health check failed for ${config.name}: ${errorMessage}`,
          config.critical ? 'high' : 'medium',
          'system',
          { metadata: { responseTime, component: config.name } },
          ['health_check', config.name]
        );

        return {
          name: config.name,
          status: 'unhealthy' as HealthStatus,
          responseTime,
          message: `Health check failed: ${errorMessage}`,
          lastChecked: new Date().toISOString(),
          critical: config.critical
        } as ComponentHealth;
      }
    });

    // Wait for all health checks to complete
    components.push(...await Promise.all(healthCheckPromises));

    // Calculate overall system status
    const summary = this.calculateSummary(components);
    const overallStatus = this.determineOverallStatus(components);

    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      environment: this.environment,
      components,
      summary
    };

    logger.info('System health check completed', {
      status: overallStatus,
      summary,
      duration: Date.now() - Date.parse(timestamp)
    });

    return systemHealth;
  }

     /**
    * Check database connectivity and basic operations
    */
   private async checkDatabase(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
     try {
       // Use service role key for health checks - no need for cookies
       const supabase = createServerClient(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!,
         {
           cookies: {
             get() { return undefined; },
             set() {},
             remove() {},
           },
         }
       );

      // Test basic database connectivity
      const startTime = Date.now();
      const { error } = await supabase
        .from('betting_rounds')
        .select('id')
        .limit(1);

      const queryTime = Date.now() - startTime;

      if (error) {
        return {
          status: 'unhealthy',
          message: `Database query failed: ${error.message}`,
          details: { error: error.message, queryTime }
        };
      }

      // Check if we can write (test with a simple count)
      const { count, error: countError } = await supabase
        .from('betting_rounds')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        return {
          status: 'degraded',
          message: `Database read-only or count failed: ${countError.message}`,
          details: { error: countError.message, queryTime }
        };
      }

      return {
        status: 'healthy',
        message: 'Database is responsive and accessible',
        details: { 
          queryTime,
          totalRounds: count,
          hasData: (count || 0) > 0
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      return {
        status: 'unhealthy',
        message: `Database connection failed: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Check email service availability
   */
  private async checkEmailService(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
    try {
      // Check if Resend API key is configured
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return {
          status: 'unhealthy',
          message: 'Resend API key not configured',
          details: { configured: false }
        };
      }

      // Test Resend API connectivity (without sending an email)
      const startTime = Date.now();
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'unhealthy',
          message: `Email service API error: ${response.status} ${response.statusText}`,
          details: { 
            statusCode: response.status,
            statusText: response.statusText,
            responseTime
          }
        };
      }

      const data = await response.json();

      return {
        status: 'healthy',
        message: 'Email service is accessible and authenticated',
        details: { 
          responseTime,
          domains: data.data?.length || 0,
          authenticated: true
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown email service error';
      return {
        status: 'unhealthy',
        message: `Email service check failed: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Check Football API availability
   */
  private async checkFootballAPI(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
    try {
      const apiKey = process.env.FOOTBALL_API_KEY;
      if (!apiKey) {
        return {
          status: 'degraded',
          message: 'Football API key not configured',
          details: { configured: false }
        };
      }

      const startTime = Date.now();
      const response = await fetch('https://api-football-v1.p.rapidapi.com/v3/status', {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'degraded',
          message: `Football API error: ${response.status} ${response.statusText}`,
          details: { 
            statusCode: response.status,
            statusText: response.statusText,
            responseTime
          }
        };
      }

      const data = await response.json();

      return {
        status: 'healthy',
        message: 'Football API is accessible',
        details: { 
          responseTime,
          account: data.response?.account || 'unknown',
          requests: data.response?.requests || {}
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Football API error';
      return {
        status: 'degraded',
        message: `Football API check failed: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const usedMemoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const memoryUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

      let status: HealthStatus = 'healthy';
      let message = `Memory usage: ${usedMemoryMB}MB / ${totalMemoryMB}MB (${memoryUsagePercent}%)`;

      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        message = `Critical memory usage: ${memoryUsagePercent}%`;
      } else if (memoryUsagePercent > 80) {
        status = 'degraded';
        message = `High memory usage: ${memoryUsagePercent}%`;
      }

      return {
        status,
        message,
        details: {
          heapUsed: usedMemoryMB,
          heapTotal: totalMemoryMB,
          usagePercent: memoryUsagePercent,
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown memory check error';
      return {
        status: 'unknown',
        message: `Memory check failed: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Check disk space (simplified for serverless)
   */
  private async checkDiskSpace(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
    try {
      // In serverless environments, disk space is typically not a concern
      // But we can check if we can write temporary files
             const fs = await import('fs');
       const path = await import('path');
      const tmpDir = '/tmp';
      
             const testFile = path.join(tmpDir, `health-check-${Date.now()}.tmp`);
       
       await fs.promises.writeFile(testFile, 'health check test');
       await fs.promises.unlink(testFile);

      return {
        status: 'healthy',
        message: 'Temporary file system is writable',
        details: { 
          writable: true,
          environment: 'serverless'
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown disk check error';
      return {
        status: 'degraded',
        message: `Disk write test failed: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Check required environment variables
   */
  private async checkEnvironmentVariables(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY'
    ];

    const optionalVars = [
      'FOOTBALL_API_KEY',
      'CRON_SECRET',
      'ANTHROPIC_API_KEY'
    ];

    const missing: string[] = [];
    const present: string[] = [];
    const optional: string[] = [];

    // Check required variables
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        present.push(varName);
      } else {
        missing.push(varName);
      }
    }

    // Check optional variables
    for (const varName of optionalVars) {
      if (process.env[varName]) {
        optional.push(varName);
      }
    }

    let status: HealthStatus = 'healthy';
    let message = `Environment: ${present.length}/${requiredVars.length} required variables configured`;

    if (missing.length > 0) {
      status = 'unhealthy';
      message = `Missing required environment variables: ${missing.join(', ')}`;
    }

    return {
      status,
      message,
      details: {
        required: {
          total: requiredVars.length,
          present: present.length,
          missing: missing.length,
          missingVars: missing
        },
        optional: {
          total: optionalVars.length,
          present: optional.length,
          presentVars: optional
        }
      }
    };
  }

  /**
   * Check essential data exists for core functionality
   */
  private async checkEssentialData(): Promise<{ status: HealthStatus; message: string; details?: Record<string, unknown> }> {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get() { return undefined; },
            set() {},
            remove() {},
          },
        }
      );

      const checks = [
        { table: 'competitions', minRequired: 1, name: 'Competitions' },
        { table: 'seasons', minRequired: 1, name: 'Seasons' },
        { table: 'teams', minRequired: 4, name: 'Teams' },
        { table: 'players', minRequired: 5, name: 'Players' },
        { table: 'player_statistics', minRequired: 5, name: 'Player Statistics' },
        { table: 'betting_rounds', minRequired: 1, name: 'Betting Rounds' }
      ];

      const results: Record<string, number> = {};
      const issues: string[] = [];

      for (const check of checks) {
        const { data, error } = await supabase
          .from(check.table)
          .select('id', { count: 'exact' });

        if (error) {
          issues.push(`${check.name}: Query failed - ${error.message}`);
          continue;
        }

        const count = data?.length || 0;
        results[check.table] = count;

        if (count < check.minRequired) {
          issues.push(`${check.name}: ${count} found, need ${check.minRequired}`);
        }
      }

      // Check current season exists and has active betting round
      const { data: currentSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('is_current', true)
        .single();

      if (!currentSeason) {
        issues.push('No current season found');
      } else {
        // Check if players are linked to current season (critical for top scorer)
        const { data: linkedPlayers } = await supabase
          .from('player_statistics')
          .select('id')
          .eq('season_id', currentSeason.id);

        if (!linkedPlayers || linkedPlayers.length < 5) {
          issues.push(`Only ${linkedPlayers?.length || 0} players linked to current season`);
        }

        // Check for open betting rounds
        const { data: openRounds } = await supabase
          .from('betting_rounds')
          .select('id')
          .eq('status', 'open');

        if (!openRounds || openRounds.length === 0) {
          issues.push('No open betting rounds found');
        }
      }

      let status: HealthStatus = 'healthy';
      let message = 'All essential data present and properly configured';

      if (issues.length > 0) {
        status = 'unhealthy';
        message = `Essential data issues: ${issues.join('; ')}`;
      }

      return {
        status,
        message,
        details: {
          counts: results,
          issues,
          currentSeason: !!currentSeason
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown data check error';
      return {
        status: 'unhealthy',
        message: `Essential data check failed: ${errorMessage}`,
        details: { error: errorMessage }
      };
    }
  }

  /**
   * Calculate summary statistics from component health results
   */
  private calculateSummary(components: ComponentHealth[]): SystemHealth['summary'] {
    const summary = {
      total: components.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      critical_issues: 0
    };

    for (const component of components) {
      switch (component.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'degraded':
          summary.degraded++;
          if (component.critical) summary.critical_issues++;
          break;
        case 'unhealthy':
          summary.unhealthy++;
          if (component.critical) summary.critical_issues++;
          break;
      }
    }

    return summary;
  }

  /**
   * Determine overall system status based on component health
   */
  private determineOverallStatus(components: ComponentHealth[]): HealthStatus {
    const criticalUnhealthy = components.some(c => c.critical && c.status === 'unhealthy');
    const criticalDegraded = components.some(c => c.critical && c.status === 'degraded');
    const anyUnhealthy = components.some(c => c.status === 'unhealthy');
    const anyDegraded = components.some(c => c.status === 'degraded');

    if (criticalUnhealthy) {
      return 'unhealthy';
    } else if (criticalDegraded || anyUnhealthy) {
      return 'degraded';
    } else if (anyDegraded) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Get a quick health status (for lightweight checks)
   */
  async getQuickHealthStatus(): Promise<{ status: HealthStatus; message: string }> {
    try {
      // Quick database ping
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get() { return undefined; },
            set() {},
            remove() {},
          },
        }
      );

      const { error } = await supabase
        .from('betting_rounds')
        .select('id')
        .limit(1);

      if (error) {
        return {
          status: 'unhealthy',
          message: 'Database connectivity issues'
        };
      }

      return {
        status: 'healthy',
        message: 'System operational'
      };

    } catch {
      return {
        status: 'unhealthy',
        message: 'System health check failed'
      };
    }
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService(); 