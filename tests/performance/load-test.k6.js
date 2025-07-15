/**
 * K6 Load Testing Script for Last Round Special Feature
 * 
 * This script performs comprehensive load testing of API endpoints
 * with configurable user loads and SLA validation.
 * 
 * Usage:
 *   k6 run --env SCENARIO=light_load tests/performance/load-test.k6.js
 *   k6 run --env SCENARIO=moderate_load tests/performance/load-test.k6.js
 *   k6 run --env SCENARIO=heavy_load tests/performance/load-test.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const cupStatusTrend = new Trend('cup_status_duration');
const cupStandingsTrend = new Trend('cup_standings_duration');
const standingsTrend = new Trend('standings_duration');
const hallOfFameTrend = new Trend('hall_of_fame_duration');

// Configuration based on environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'light_load';

// Load scenarios configuration
const scenarios = {
  light_load: {
    users: 50,
    duration: '5m',
    rampUp: '1m',
    sla: { p95: 500, p99: 1000 }
  },
  moderate_load: {
    users: 200,
    duration: '10m',
    rampUp: '2m',
    sla: { p95: 800, p99: 1500 }
  },
  heavy_load: {
    users: 500,
    duration: '15m',
    rampUp: '5m',
    sla: { p95: 1200, p99: 2000 }
  }
};

const currentScenario = scenarios[SCENARIO] || scenarios.light_load;

export const options = {
  stages: [
    { duration: currentScenario.rampUp, target: currentScenario.users },
    { duration: currentScenario.duration, target: currentScenario.users },
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: [`p(95)<${currentScenario.sla.p95}`, `p(99)<${currentScenario.sla.p99}`],
    http_req_failed: ['rate<0.05'], // Error rate < 5%
    errors: ['rate<0.05'],
    
    // Endpoint-specific thresholds
    cup_status_duration: ['p(95)<200', 'p(99)<400'],
    cup_standings_duration: ['p(95)<500', 'p(99)<800'],
    standings_duration: ['p(95)<500', 'p(99)<800'],
    hall_of_fame_duration: ['p(95)<1000', 'p(99)<1500'],
  },
};

/**
 * Test scenario simulating realistic user behavior
 */
export default function () {
  // Simulate user journey: Check cup status → View standings → Browse hall of fame
  
  // 1. Check cup status (most frequent operation)
  testCupStatus();
  sleep(1);
  
  // 2. View standings (50% of users)
  if (Math.random() < 0.5) {
    testStandings();
    sleep(1);
  }
  
  // 3. Check cup standings if cup is active (30% of users)
  if (Math.random() < 0.3) {
    testCupStandings();
    sleep(1);
  }
  
  // 4. Browse hall of fame (20% of users)
  if (Math.random() < 0.2) {
    testHallOfFame();
    sleep(2);
  }
  
  // Random sleep to simulate user reading time
  sleep(Math.random() * 3 + 1);
}

function testCupStatus() {
  const response = http.get(`${BASE_URL}/api/last-round-special/status`);
  
  const success = check(response, {
    'Cup Status: Status is 200': (r) => r.status === 200,
    'Cup Status: Response time < 200ms': (r) => r.timings.duration < 200,
    'Cup Status: Has required fields': (r) => {
      const data = JSON.parse(r.body);
      return data.hasOwnProperty('isActive') && data.hasOwnProperty('activationDate');
    },
  });
  
  cupStatusTrend.add(response.timings.duration);
  errorRate.add(!success);
}

function testCupStandings() {
  const response = http.get(`${BASE_URL}/api/last-round-special/standings`);
  
  const success = check(response, {
    'Cup Standings: Status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'Cup Standings: Response time < 500ms': (r) => r.timings.duration < 500,
    'Cup Standings: Valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch (e) {
        return false;
      }
    },
  });
  
  cupStandingsTrend.add(response.timings.duration);
  errorRate.add(!success);
}

function testStandings() {
  const response = http.get(`${BASE_URL}/api/standings`);
  
  const success = check(response, {
    'Standings: Status is 200': (r) => r.status === 200,
    'Standings: Response time < 500ms': (r) => r.timings.duration < 500,
    'Standings: Has standings data': (r) => {
      const data = JSON.parse(r.body);
      return data.hasOwnProperty('league_standings') || data.hasOwnProperty('cup_standings');
    },
  });
  
  standingsTrend.add(response.timings.duration);
  errorRate.add(!success);
}

function testHallOfFame() {
  const response = http.get(`${BASE_URL}/api/hall-of-fame`);
  
  const success = check(response, {
    'Hall of Fame: Status is 200': (r) => r.status === 200,
    'Hall of Fame: Response time < 1000ms': (r) => r.timings.duration < 1000,
    'Hall of Fame: Has winners data': (r) => {
      const data = JSON.parse(r.body);
      return Array.isArray(data.winners);
    },
  });
  
  hallOfFameTrend.add(response.timings.duration);
  errorRate.add(!success);
}

/**
 * Setup function called once before load test
 */
export function setup() {
  console.log(`Starting ${SCENARIO} load test with ${currentScenario.users} users`);
  console.log(`Duration: ${currentScenario.duration}, Ramp-up: ${currentScenario.rampUp}`);
  console.log(`SLA Thresholds - P95: ${currentScenario.sla.p95}ms, P99: ${currentScenario.sla.p99}ms`);
  
  // Warmup request to ensure server is ready
  const warmupResponse = http.get(`${BASE_URL}/api/health`);
  if (warmupResponse.status !== 200) {
    console.error('Server warmup failed. Aborting test.');
    return null;
  }
  
  return { baseUrl: BASE_URL, scenario: SCENARIO };
}

/**
 * Teardown function called after load test completes
 */
export function teardown(data) {
  console.log(`Load test completed for scenario: ${data.scenario}`);
  console.log('Check the detailed results above for SLA compliance and performance metrics.');
} 