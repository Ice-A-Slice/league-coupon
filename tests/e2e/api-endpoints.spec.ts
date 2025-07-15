import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests: API Endpoints
 * 
 * Tests all Last Round Special API endpoints for functionality,
 * performance, and error handling corresponding to UC-6 scenarios.
 */

test.describe('Last Round Special API Endpoints', () => {

  test('UC-6.1: Cup Status API comprehensive testing', async ({ request }) => {
    test.setTimeout(30000);
    
    // Test basic functionality
    const response = await request.get('/api/last-round-special/status');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('is_active');
    expect(data.data).toHaveProperty('season_id');
    expect(data.data).toHaveProperty('season_name');
    expect(data.data).toHaveProperty('activated_at');
    
    // Verify data types
    expect(typeof data.data.is_active).toBe('boolean');
    if (data.data.season_id !== null) {
      expect(typeof data.data.season_id).toBe('number');
    }
    
    // Test response time (SLA: under 200ms)
    const startTime = Date.now();
    await request.get('/api/last-round-special/status');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(200);
  });

  test('UC-6.2: Cup Standings API comprehensive testing', async ({ request }) => {
    test.setTimeout(30000);
    
    // Test basic request
    const response = await request.get('/api/last-round-special/standings');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    
    // Data should be an array (can be empty if cup not active)
    expect(Array.isArray(data.data)).toBeTruthy();
    
    // Test response time (SLA: under 500ms)
    const startTime = Date.now();
    await request.get('/api/last-round-special/standings');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(500);
  });

  test('UC-6.3: Enhanced Standings API testing', async ({ request }) => {
    test.setTimeout(30000);
    
    // Test main standings endpoint
    const response = await request.get('/api/standings');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Verify response structure includes both league and cup data
    expect(data).toHaveProperty('league_standings');
    expect(data).toHaveProperty('cup');
    expect(Array.isArray(data.league_standings)).toBeTruthy();
    
    // When cup is active, should include cup standings
    if (data.cup && data.cup.is_active) {
      expect(data.cup).toHaveProperty('standings');
      expect(Array.isArray(data.cup.standings)).toBeTruthy();
    }
    
    // Test response time (SLA: under 500ms)
    const startTime = Date.now();
    await request.get('/api/standings');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(500);
  });

  test('UC-6.4: Cup Standings API testing', async ({ request }) => {
    test.setTimeout(30000);
    
    // Test basic functionality
    const response = await request.get('/api/last-round-special/standings');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    
    // Data should be an array (can be empty if cup not active)
    expect(Array.isArray(data.data)).toBeTruthy();
    
    // Test response time (SLA: under 500ms)
    const startTime = Date.now();
    await request.get('/api/last-round-special/standings');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(500);
  });

  test('UC-6.5: Hall of Fame API testing', async ({ request }) => {
    test.setTimeout(30000);
    
    // Test basic functionality
    const response = await request.get('/api/hall-of-fame');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('leagueWinners');
    expect(data).toHaveProperty('cupWinners');
    expect(Array.isArray(data.leagueWinners)).toBeTruthy();
    expect(Array.isArray(data.cupWinners)).toBeTruthy();
    
    // Test response time (SLA: under 1000ms for complex query)
    const startTime = Date.now();
    await request.get('/api/hall-of-fame');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(1000);
  });

  test('UC-6.6: API Performance under concurrent load', async ({ request }) => {
    test.setTimeout(60000);
    
    // Test multiple concurrent requests to different endpoints
    const endpoints = [
      '/api/last-round-special/status',
      '/api/standings',
      '/api/last-round-special/standings'
    ];
    
    const concurrentRequests = 10;
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      for (const endpoint of endpoints) {
        promises.push(request.get(endpoint));
      }
    }
    
    const responses = await Promise.all(promises);
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });

  test('API Error handling and edge cases', async ({ request }) => {
    // Test invalid parameters
    const invalidSeason = await request.get('/api/last-round-special/standings?season=invalid');
    expect(invalidSeason.ok()).toBeTruthy(); // Should handle gracefully
    
    // Test extreme pagination values
    const extremePagination = await request.get('/api/last-round-special/standings?page=999999&limit=1000');
    expect(extremePagination.ok()).toBeTruthy();
    
    // Test malformed parameters
    const malformedParams = await request.get('/api/last-round-special/standings?sort=invalid&order=invalid');
    expect(malformedParams.ok()).toBeTruthy();
  });

  test('API Data consistency and validation', async ({ request }) => {
    // Get data from multiple endpoints and verify consistency
    const statusResponse = await request.get('/api/last-round-special/status');
    const enhancedResponse = await request.get('/api/standings');
    
    expect(statusResponse.ok()).toBeTruthy();
    expect(enhancedResponse.ok()).toBeTruthy();
    
    const statusData = await statusResponse.json();
    const enhancedData = await enhancedResponse.json();
    
    // Cup status should be consistent between endpoints
    expect(statusData.data.is_active).toBe(enhancedData.cup.is_active);
    
    // Season information should be consistent
    if (statusData.data.season_id) {
      expect(statusData.data.season_id).toBe(enhancedData.cup.season_id);
    }
  });

  test('HTTP Headers and Caching', async ({ request }) => {
    const response = await request.get('/api/last-round-special/status');
    expect(response.ok()).toBeTruthy();
    
    // Check for appropriate headers
    const headers = response.headers();
    expect(headers).toHaveProperty('content-type');
    expect(headers['content-type']).toContain('application/json');
    
    // Check for caching headers (if implemented)
    if (headers['cache-control']) {
      expect(headers['cache-control']).toBeTruthy();
    }
  });
}); 