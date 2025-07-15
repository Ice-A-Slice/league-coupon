/**
 * Performance Testing Configuration
 * 
 * Defines load scenarios, SLA thresholds, and performance test parameters
 * for the Last Round Special feature.
 */

export interface LoadScenario {
  name: string;
  description: string;
  users: number;
  duration: number; // seconds
  rampUp: number; // seconds
  slaThresholds: {
    p50: number; // 50th percentile response time (ms)
    p95: number; // 95th percentile response time (ms)
    p99: number; // 99th percentile response time (ms)
    errorRate: number; // maximum acceptable error rate (%)
  };
}

export interface ApiEndpoint {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatusCode: number;
  slaResponseTime: number; // milliseconds
  payload?: object;
}

// Load Testing Scenarios
export const LOAD_SCENARIOS: LoadScenario[] = [
  {
    name: 'light_load',
    description: 'Light load - Normal traffic simulation',
    users: 50,
    duration: 300, // 5 minutes
    rampUp: 60,    // 1 minute ramp-up
    slaThresholds: {
      p50: 200,  // 200ms median response
      p95: 500,  // 500ms for 95th percentile
      p99: 1000, // 1 second for 99th percentile
      errorRate: 1.0 // Max 1% error rate
    }
  },
  {
    name: 'moderate_load',
    description: 'Moderate load - Peak traffic simulation',
    users: 200,
    duration: 600, // 10 minutes
    rampUp: 120,   // 2 minute ramp-up
    slaThresholds: {
      p50: 300,  // 300ms median response
      p95: 800,  // 800ms for 95th percentile
      p99: 1500, // 1.5 seconds for 99th percentile
      errorRate: 2.0 // Max 2% error rate
    }
  },
  {
    name: 'heavy_load',
    description: 'Heavy load - Stress testing scenario',
    users: 500,
    duration: 900, // 15 minutes
    rampUp: 300,   // 5 minute ramp-up
    slaThresholds: {
      p50: 500,  // 500ms median response
      p95: 1200, // 1.2 seconds for 95th percentile
      p99: 2000, // 2 seconds for 99th percentile
      errorRate: 5.0 // Max 5% error rate
    }
  }
];

// API Endpoints for Performance Testing
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    name: 'cup_status',
    path: '/api/last-round-special/status',
    method: 'GET',
    expectedStatusCode: 200,
    slaResponseTime: 200
  },
  {
    name: 'cup_standings',
    path: '/api/last-round-special/standings',
    method: 'GET',
    expectedStatusCode: 200,
    slaResponseTime: 500
  },
  {
    name: 'enhanced_standings',
    path: '/api/standings',
    method: 'GET',
    expectedStatusCode: 200,
    slaResponseTime: 500
  },
  {
    name: 'hall_of_fame',
    path: '/api/hall-of-fame',
    method: 'GET',
    expectedStatusCode: 200,
    slaResponseTime: 1000
  },
  {
    name: 'fixtures',
    path: '/api/fixtures',
    method: 'GET',
    expectedStatusCode: 200,
    slaResponseTime: 300
  }
];

// Performance Test Configuration
export const PERFORMANCE_CONFIG = {
  baseUrl: process.env.PERF_BASE_URL || 'http://localhost:3000',
  
  // Test execution settings
  warmupRequests: 10,
  reportInterval: 10, // seconds
  
  // Resource monitoring
  monitorCpu: true,
  monitorMemory: true,
  monitorDatabase: true,
  
  // Output settings
  outputDir: 'test-results/performance',
  generateHtmlReport: true,
  
  // SLA validation
  failOnSlaViolation: true,
  slaTolerancePercent: 10, // Allow 10% tolerance on SLA thresholds
  
  // Database connection monitoring
  dbConnectionPoolSize: 20,
  maxDbConnections: 100
} as const;

export default PERFORMANCE_CONFIG; 