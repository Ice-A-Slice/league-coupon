/**
 * Database Performance Monitoring
 * 
 * Monitors database performance metrics during load testing including:
 * - Connection pool usage
 * - Query execution times
 * - Resource utilization
 * - Lock contention
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

interface DatabaseMetrics {
  timestamp: number;
  activeConnections: number;
  totalConnections: number;
  connectionPoolUtilization: number;
  averageQueryTime: number;
  slowQueries: number;
  lockWaitTime: number;
  cacheHitRatio: number;
  transactionsPerSecond: number;
  deadlocks: number;
  memoryUsage: number;
}

interface QueryPerformance {
  query: string;
  executionTime: number;
  timestamp: number;
  success: boolean;
}

class DatabasePerformanceMonitor {
  private supabase: any;
  private metrics: DatabaseMetrics[] = [];
  private queryPerformance: QueryPerformance[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Start monitoring database performance
   */
  async startMonitoring(intervalMs: number = 10000): Promise<void> {
    if (this.isMonitoring) {
      console.log('Database monitoring already started');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting database performance monitoring (interval: ${intervalMs}ms)`);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting database metrics:', error);
      }
    }, intervalMs);

    // Initial metrics collection
    await this.collectMetrics();
  }

  /**
   * Stop monitoring and generate report
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      console.log('Database monitoring not started');
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Stopped database performance monitoring');
    await this.generateReport();
  }

  /**
   * Collect current database metrics
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now();
    
    try {
      // Simulate database metrics collection
      // In a real implementation, these would be actual database queries
      const metrics: DatabaseMetrics = {
        timestamp,
        activeConnections: await this.getActiveConnections(),
        totalConnections: await this.getTotalConnections(),
        connectionPoolUtilization: await this.getConnectionPoolUtilization(),
        averageQueryTime: await this.getAverageQueryTime(),
        slowQueries: await this.getSlowQueryCount(),
        lockWaitTime: await this.getLockWaitTime(),
        cacheHitRatio: await this.getCacheHitRatio(),
        transactionsPerSecond: await this.getTransactionsPerSecond(),
        deadlocks: await this.getDeadlockCount(),
        memoryUsage: await this.getMemoryUsage()
      };

      this.metrics.push(metrics);
      
      // Log critical metrics
      if (metrics.connectionPoolUtilization > 80) {
        console.warn(`⚠️  High connection pool utilization: ${metrics.connectionPoolUtilization}%`);
      }
      
      if (metrics.averageQueryTime > 1000) {
        console.warn(`⚠️  High average query time: ${metrics.averageQueryTime}ms`);
      }
      
      if (metrics.slowQueries > 10) {
        console.warn(`⚠️  Many slow queries detected: ${metrics.slowQueries}`);
      }

    } catch (error) {
      console.error('Failed to collect database metrics:', error);
    }
  }

  /**
   * Monitor specific query performance
   */
  async monitorQuery(queryName: string, queryFn: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    let success = false;
    let result;

    try {
      result = await queryFn();
      success = true;
      return result;
    } catch (error) {
      console.error(`Query ${queryName} failed:`, error);
      throw error;
    } finally {
      const executionTime = Date.now() - startTime;
      
      this.queryPerformance.push({
        query: queryName,
        executionTime,
        timestamp: startTime,
        success
      });

      // Log slow queries immediately
      if (executionTime > 1000) {
        console.warn(`🐌 Slow query detected: ${queryName} took ${executionTime}ms`);
      }
    }
  }

  /**
   * Generate comprehensive performance report
   */
  private async generateReport(): Promise<void> {
    const reportDir = 'test-results/performance';
    
    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Generate metrics summary
    const summary = this.generateMetricsSummary();
    
    // Generate query performance analysis
    const queryAnalysis = this.generateQueryAnalysis();

    // Create comprehensive report
    const report = {
      testInfo: {
        startTime: this.metrics[0]?.timestamp || Date.now(),
        endTime: this.metrics[this.metrics.length - 1]?.timestamp || Date.now(),
        duration: this.metrics.length > 0 ? 
          this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp : 0,
        dataPoints: this.metrics.length
      },
      summary,
      queryAnalysis,
      rawMetrics: this.metrics,
      rawQueryData: this.queryPerformance,
      recommendations: this.generateRecommendations(summary)
    };

    // Write reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `db-performance-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Write CSV for easy analysis
    const csvPath = path.join(reportDir, `db-metrics-${timestamp}.csv`);
    this.writeMetricsToCsv(csvPath);

    console.log(`📊 Database performance report generated:`);
    console.log(`   JSON Report: ${reportPath}`);
    console.log(`   CSV Data: ${csvPath}`);
    
    // Print summary to console
    this.printSummaryToConsole(summary);
  }

  // Mock implementations for database metrics
  // In production, these would connect to actual database monitoring APIs
  
  private async getActiveConnections(): Promise<number> {
    // Simulate getting active connections from pg_stat_activity or similar
    return Math.floor(Math.random() * 50) + 10;
  }

  private async getTotalConnections(): Promise<number> {
    return 100; // Max connections in pool
  }

  private async getConnectionPoolUtilization(): Promise<number> {
    const active = await this.getActiveConnections();
    const total = await this.getTotalConnections();
    return Math.round((active / total) * 100);
  }

  private async getAverageQueryTime(): Promise<number> {
    // Simulate average query execution time
    return Math.random() * 500 + 50;
  }

  private async getSlowQueryCount(): Promise<number> {
    // Queries taking > 1 second
    return Math.floor(Math.random() * 5);
  }

  private async getLockWaitTime(): Promise<number> {
    return Math.random() * 100;
  }

  private async getCacheHitRatio(): Promise<number> {
    return Math.random() * 10 + 90; // 90-100%
  }

  private async getTransactionsPerSecond(): Promise<number> {
    return Math.random() * 1000 + 100;
  }

  private async getDeadlockCount(): Promise<number> {
    return Math.floor(Math.random() * 3);
  }

  private async getMemoryUsage(): Promise<number> {
    return Math.random() * 40 + 30; // 30-70% memory usage
  }

  private generateMetricsSummary() {
    if (this.metrics.length === 0) return null;

    const avgConnectionUtil = this.metrics.reduce((sum, m) => sum + m.connectionPoolUtilization, 0) / this.metrics.length;
    const maxConnectionUtil = Math.max(...this.metrics.map(m => m.connectionPoolUtilization));
    const avgQueryTime = this.metrics.reduce((sum, m) => sum + m.averageQueryTime, 0) / this.metrics.length;
    const maxQueryTime = Math.max(...this.metrics.map(m => m.averageQueryTime));
    const totalSlowQueries = this.metrics.reduce((sum, m) => sum + m.slowQueries, 0);

    return {
      avgConnectionUtilization: Math.round(avgConnectionUtil * 100) / 100,
      maxConnectionUtilization: maxConnectionUtil,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      maxQueryTime: Math.round(maxQueryTime * 100) / 100,
      totalSlowQueries,
      slaViolations: {
        highConnectionUtil: this.metrics.filter(m => m.connectionPoolUtilization > 80).length,
        slowQueries: this.metrics.filter(m => m.averageQueryTime > 1000).length
      }
    };
  }

  private generateQueryAnalysis() {
    if (this.queryPerformance.length === 0) return null;

    const queryStats: Record<string, any> = {};
    
    this.queryPerformance.forEach(perf => {
      if (!queryStats[perf.query]) {
        queryStats[perf.query] = {
          count: 0,
          totalTime: 0,
          successCount: 0,
          failCount: 0,
          minTime: Infinity,
          maxTime: 0
        };
      }
      
      const stats = queryStats[perf.query];
      stats.count++;
      stats.totalTime += perf.executionTime;
      if (perf.success) stats.successCount++;
      else stats.failCount++;
      stats.minTime = Math.min(stats.minTime, perf.executionTime);
      stats.maxTime = Math.max(stats.maxTime, perf.executionTime);
    });

    // Calculate averages and success rates
    Object.keys(queryStats).forEach(query => {
      const stats = queryStats[query];
      stats.avgTime = stats.totalTime / stats.count;
      stats.successRate = (stats.successCount / stats.count) * 100;
    });

    return queryStats;
  }

  private generateRecommendations(summary: any) {
    const recommendations: string[] = [];

    if (summary?.maxConnectionUtilization > 80) {
      recommendations.push('Consider increasing database connection pool size');
    }

    if (summary?.avgQueryTime > 500) {
      recommendations.push('Optimize slow queries or add database indexes');
    }

    if (summary?.totalSlowQueries > 50) {
      recommendations.push('Review and optimize frequently slow queries');
    }

    return recommendations;
  }

  private writeMetricsToCsv(csvPath: string): void {
    const headers = [
      'timestamp', 'activeConnections', 'connectionPoolUtilization',
      'averageQueryTime', 'slowQueries', 'cacheHitRatio', 'transactionsPerSecond'
    ];
    
    const csvContent = [
      headers.join(','),
      ...this.metrics.map(m => 
        headers.map(h => (m as any)[h]).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
  }

  private printSummaryToConsole(summary: any): void {
    console.log('\n📊 DATABASE PERFORMANCE SUMMARY');
    console.log('================================');
    console.log(`Average Connection Utilization: ${summary.avgConnectionUtilization}%`);
    console.log(`Max Connection Utilization: ${summary.maxConnectionUtilization}%`);
    console.log(`Average Query Time: ${summary.avgQueryTime}ms`);
    console.log(`Max Query Time: ${summary.maxQueryTime}ms`);
    console.log(`Total Slow Queries: ${summary.totalSlowQueries}`);
    console.log(`SLA Violations - High Connection Util: ${summary.slaViolations.highConnectionUtil}`);
    console.log(`SLA Violations - Slow Queries: ${summary.slaViolations.slowQueries}`);
  }
}

export default DatabasePerformanceMonitor; 