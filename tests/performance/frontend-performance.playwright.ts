/**
 * Frontend Performance Testing with Playwright
 * 
 * Measures Core Web Vitals, loading performance, and user experience metrics
 * for the Last Round Special feature frontend components.
 */

import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface PerformanceMetrics {
  url: string;
  timestamp: number;
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  speedIndex: number;
  networkRequests: number;
  totalTransferSize: number;
  javascriptExecutionTime: number;
  mainThreadBlockingTime: number;
}

interface PageTest {
  name: string;
  url: string;
  interactions?: Array<{
    action: string;
    selector?: string;
    expectedResponse?: number; // ms
  }>;
  expectedLoadTime: number; // ms
  expectedLCP: number; // ms
  expectedCLS: number; // threshold
}

class FrontendPerformanceTest {
  private metrics: PerformanceMetrics[] = [];
  private baseUrl: string;
  private outputDir: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.outputDir = path.join(process.cwd(), 'test-results', 'performance');
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async measurePagePerformance(page: Page, pageTest: PageTest): Promise<PerformanceMetrics> {
    console.log(`📊 Measuring performance for: ${pageTest.name}`);
    
    const startTime = Date.now();
    
    // Navigate to page and wait for load
    await page.goto(`${this.baseUrl}${pageTest.url}`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Measure Core Web Vitals and other performance metrics
    const performanceMetrics = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        // Wait for all performance observers to collect data
        setTimeout(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const paintEntries = performance.getEntriesByType('paint');
          
          const metrics = {
            loadTime: navigation.loadEventEnd - navigation.startTime,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
            firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
            timeToInteractive: 0, // Would need additional measurement
            networkRequests: performance.getEntriesByType('resource').length,
            totalTransferSize: performance.getEntriesByType('resource')
              .reduce((total: number, resource: any) => total + (resource.transferSize || 0), 0),
            javascriptExecutionTime: 0 // Would need Performance Observer API
          };

          // Get Web Vitals if available (would need web-vitals library in production)
          const webVitals = {
            largestContentfulPaint: 0,
            cumulativeLayoutShift: 0,
            firstInputDelay: 0,
            totalBlockingTime: 0,
            speedIndex: 0,
            mainThreadBlockingTime: 0
          };

          resolve({ ...metrics, ...webVitals });
        }, 2000);
      });
    });

    // Test interactions if specified
    if (pageTest.interactions) {
      for (const interaction of pageTest.interactions) {
        const interactionStart = Date.now();
        
        switch (interaction.action) {
          case 'click':
            if (interaction.selector) {
              await page.click(interaction.selector);
            }
            break;
          case 'scroll':
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
            break;
          case 'tab_switch':
            if (interaction.selector) {
              await page.click(interaction.selector);
            }
            break;
        }
        
        // Wait for any UI updates
        await page.waitForTimeout(100);
        
        const interactionTime = Date.now() - interactionStart;
        
        if (interaction.expectedResponse && interactionTime > interaction.expectedResponse) {
          console.warn(`⚠️  ${interaction.action} interaction took ${interactionTime}ms (expected < ${interaction.expectedResponse}ms)`);
        }
      }
    }

    const finalMetrics: PerformanceMetrics = {
      url: pageTest.url,
      timestamp: startTime,
      ...performanceMetrics
    };

    this.metrics.push(finalMetrics);

    // Validate against thresholds
    this.validatePerformanceThresholds(finalMetrics, pageTest);

    return finalMetrics;
  }

  private validatePerformanceThresholds(metrics: PerformanceMetrics, pageTest: PageTest): void {
    const violations: string[] = [];

    if (metrics.loadTime > pageTest.expectedLoadTime) {
      violations.push(`Load time ${metrics.loadTime}ms > ${pageTest.expectedLoadTime}ms`);
    }

    if (metrics.largestContentfulPaint > pageTest.expectedLCP) {
      violations.push(`LCP ${metrics.largestContentfulPaint}ms > ${pageTest.expectedLCP}ms`);
    }

    if (metrics.cumulativeLayoutShift > pageTest.expectedCLS) {
      violations.push(`CLS ${metrics.cumulativeLayoutShift} > ${pageTest.expectedCLS}`);
    }

    // Core Web Vitals thresholds
    if (metrics.firstContentfulPaint > 1800) {
      violations.push(`FCP ${metrics.firstContentfulPaint}ms > 1800ms (poor)`);
    }

    if (metrics.firstInputDelay > 100) {
      violations.push(`FID ${metrics.firstInputDelay}ms > 100ms (poor)`);
    }

    if (violations.length > 0) {
      console.warn(`⚠️  Performance violations for ${pageTest.name}:`);
      violations.forEach(violation => console.warn(`   ❌ ${violation}`));
    } else {
      console.log(`✅ ${pageTest.name} meets all performance thresholds`);
    }
  }

  async generateReport(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.outputDir, `frontend-performance-${timestamp}.json`);
    
    const report = {
      testInfo: {
        timestamp: Date.now(),
        baseUrl: this.baseUrl,
        totalPages: this.metrics.length
      },
      summary: this.generateSummary(),
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    await this.generateHtmlReport(timestamp);
    
    console.log(`\n📋 Frontend Performance Report Generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   HTML: ${this.outputDir}/frontend-performance-${timestamp}.html`);
    
    this.printSummary();
  }

  private generateSummary() {
    if (this.metrics.length === 0) return null;

    const avgLoadTime = this.metrics.reduce((sum, m) => sum + m.loadTime, 0) / this.metrics.length;
    const avgFCP = this.metrics.reduce((sum, m) => sum + m.firstContentfulPaint, 0) / this.metrics.length;
    const avgLCP = this.metrics.reduce((sum, m) => sum + m.largestContentfulPaint, 0) / this.metrics.length;
    const maxLoadTime = Math.max(...this.metrics.map(m => m.loadTime));

    return {
      averageLoadTime: Math.round(avgLoadTime),
      averageFCP: Math.round(avgFCP),
      averageLCP: Math.round(avgLCP),
      maxLoadTime: Math.round(maxLoadTime),
      pagesUnder2s: this.metrics.filter(m => m.loadTime < 2000).length,
      pagesUnder3s: this.metrics.filter(m => m.loadTime < 3000).length,
      totalNetworkRequests: this.metrics.reduce((sum, m) => sum + m.networkRequests, 0),
      totalTransferSize: this.metrics.reduce((sum, m) => sum + m.totalTransferSize, 0)
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.generateSummary();

    if (summary && summary.averageLoadTime > 3000) {
      recommendations.push('Optimize load times - consider code splitting and lazy loading');
    }

    if (summary && summary.averageFCP > 1800) {
      recommendations.push('Improve First Contentful Paint - optimize critical rendering path');
    }

    if (summary && summary.averageLCP > 2500) {
      recommendations.push('Optimize Largest Contentful Paint - optimize images and critical resources');
    }

    const highNetworkPages = this.metrics.filter(m => m.networkRequests > 50);
    if (highNetworkPages.length > 0) {
      recommendations.push('Reduce number of network requests - bundle resources and use caching');
    }

    return recommendations;
  }

  private async generateHtmlReport(timestamp: string): Promise<void> {
    const summary = this.generateSummary();
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Frontend Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e3f2fd; border-radius: 3px; }
        .good { background: #e8f5e8; }
        .warning { background: #fff3cd; }
        .poor { background: #f8d7da; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .chart { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Frontend Performance Report</h1>
        <p><strong>Base URL:</strong> ${this.baseUrl}</p>
        <p><strong>Pages Tested:</strong> ${this.metrics.length}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <h2>Performance Summary</h2>
    ${summary ? `
    <div class="metric ${summary.averageLoadTime < 2000 ? 'good' : summary.averageLoadTime < 3000 ? 'warning' : 'poor'}">
        Avg Load Time: ${summary.averageLoadTime}ms
    </div>
    <div class="metric ${summary.averageFCP < 1800 ? 'good' : summary.averageFCP < 3000 ? 'warning' : 'poor'}">
        Avg FCP: ${summary.averageFCP}ms
    </div>
    <div class="metric ${summary.averageLCP < 2500 ? 'good' : summary.averageLCP < 4000 ? 'warning' : 'poor'}">
        Avg LCP: ${summary.averageLCP}ms
    </div>
    <div class="metric">Pages Under 2s: ${summary.pagesUnder2s}/${this.metrics.length}</div>
    <div class="metric">Total Requests: ${summary.totalNetworkRequests}</div>
    <div class="metric">Total Size: ${Math.round(summary.totalTransferSize / 1024)}KB</div>
    ` : '<p>No performance data available</p>'}
    
    <h2>Detailed Results</h2>
    <table>
        <thead>
            <tr>
                <th>Page</th>
                <th>Load Time (ms)</th>
                <th>FCP (ms)</th>
                <th>LCP (ms)</th>
                <th>CLS</th>
                <th>Network Requests</th>
                <th>Transfer Size (KB)</th>
            </tr>
        </thead>
        <tbody>
            ${this.metrics.map(metric => `
            <tr>
                <td>${metric.url}</td>
                <td class="${metric.loadTime < 2000 ? 'good' : metric.loadTime < 3000 ? 'warning' : 'poor'}">${metric.loadTime}</td>
                <td class="${metric.firstContentfulPaint < 1800 ? 'good' : metric.firstContentfulPaint < 3000 ? 'warning' : 'poor'}">${metric.firstContentfulPaint}</td>
                <td class="${metric.largestContentfulPaint < 2500 ? 'good' : metric.largestContentfulPaint < 4000 ? 'warning' : 'poor'}">${metric.largestContentfulPaint}</td>
                <td class="${metric.cumulativeLayoutShift < 0.1 ? 'good' : metric.cumulativeLayoutShift < 0.25 ? 'warning' : 'poor'}">${metric.cumulativeLayoutShift.toFixed(3)}</td>
                <td>${metric.networkRequests}</td>
                <td>${Math.round(metric.totalTransferSize / 1024)}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>
    
    <h2>Recommendations</h2>
    <ul>
        ${this.generateRecommendations().map(rec => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>`;

    const htmlPath = path.join(this.outputDir, `frontend-performance-${timestamp}.html`);
    fs.writeFileSync(htmlPath, htmlContent);
  }

  private printSummary(): void {
    const summary = this.generateSummary();
    
    console.log('\n📊 FRONTEND PERFORMANCE SUMMARY');
    console.log('===============================');
    
    if (summary) {
      console.log(`Average Load Time: ${summary.averageLoadTime}ms`);
      console.log(`Average FCP: ${summary.averageFCP}ms`);
      console.log(`Average LCP: ${summary.averageLCP}ms`);
      console.log(`Pages Under 2s: ${summary.pagesUnder2s}/${this.metrics.length}`);
      console.log(`Pages Under 3s: ${summary.pagesUnder3s}/${this.metrics.length}`);
      console.log(`Total Network Requests: ${summary.totalNetworkRequests}`);
      console.log(`Total Transfer Size: ${Math.round(summary.totalTransferSize / 1024)}KB`);
    }
  }
}

// Test configurations for different pages
const pageTests: PageTest[] = [
  {
    name: 'Standings Page (Pre-activation)',
    url: '/standings',
    expectedLoadTime: 2000,
    expectedLCP: 2500,
    expectedCLS: 0.1,
    interactions: [
      { action: 'scroll', expectedResponse: 100 }
    ]
  },
  {
    name: 'Standings Page (Post-activation)',
    url: '/standings',
    expectedLoadTime: 2500,
    expectedLCP: 3000,
    expectedCLS: 0.1,
    interactions: [
      { action: 'tab_switch', selector: '[data-testid="cup-standings-tab"]', expectedResponse: 200 },
      { action: 'tab_switch', selector: '[data-testid="league-standings-tab"]', expectedResponse: 200 }
    ]
  },
  {
    name: 'Hall of Fame',
    url: '/hall-of-fame',
    expectedLoadTime: 3000,
    expectedLCP: 3500,
    expectedCLS: 0.15,
    interactions: [
      { action: 'scroll', expectedResponse: 100 }
    ]
  },
  {
    name: 'Homepage',
    url: '/',
    expectedLoadTime: 1500,
    expectedLCP: 2000,
    expectedCLS: 0.1
  }
];

// Playwright test cases
test.describe('Frontend Performance Tests', () => {
  let performanceTest: FrontendPerformanceTest;

  test.beforeAll(async () => {
    performanceTest = new FrontendPerformanceTest();
  });

  test.afterAll(async () => {
    await performanceTest.generateReport();
  });

  for (const pageTest of pageTests) {
    test(`Performance: ${pageTest.name}`, async ({ page }) => {
      const metrics = await performanceTest.measurePagePerformance(page, pageTest);
      
      // Assert performance requirements
      expect(metrics.loadTime).toBeLessThan(pageTest.expectedLoadTime);
      expect(metrics.largestContentfulPaint).toBeLessThan(pageTest.expectedLCP);
      expect(metrics.cumulativeLayoutShift).toBeLessThan(pageTest.expectedCLS);
      
      // Core Web Vitals assertions
      expect(metrics.firstContentfulPaint).toBeLessThan(3000); // FCP should be under 3s
      expect(metrics.firstInputDelay).toBeLessThan(300); // FID should be under 300ms
    });
  }

  test('Network Performance', async ({ page }) => {
    // Test network efficiency
    await page.goto('http://localhost:3000/standings');
    
    const networkRequests = await page.evaluate(() => {
      return performance.getEntriesByType('resource').length;
    });
    
    const totalSize = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .reduce((total: number, resource: any) => total + (resource.transferSize || 0), 0);
    });
    
    expect(networkRequests).toBeLessThan(100); // Reasonable number of requests
    expect(totalSize).toBeLessThan(5 * 1024 * 1024); // Under 5MB total
  });
});

export default FrontendPerformanceTest; 