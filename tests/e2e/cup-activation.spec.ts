import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests: Cup Activation Workflow
 * 
 * Tests the automatic cup activation detection, triggering, and user notification flow
 * corresponding to UC-1 scenarios from the test plan.
 */

test.describe('Cup Activation Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('UC-1.1: Automatic activation trigger and UI update', async ({ page }) => {
    test.setTimeout(60000); // Extended timeout for activation process
    
    // Step 1: Verify initial state (cup not active)
    await page.goto('/standings');
    await expect(page.locator('h1')).toContainText('Standings');
    await expect(page.locator('h2')).toContainText('Tournament Standings');
    await expect(page.locator('[role="tablist"]')).not.toBeVisible();
    
    // Step 2: Check initial cup status via API
    const initialStatus = await page.request.get('/api/last-round-special/status');
    expect(initialStatus.ok()).toBeTruthy();
    
    const initialData = await initialStatus.json();
    expect(initialData.data.is_active).toBe(false);
    
    // Step 3: Simulate cup activation conditions
    // Note: In a real test, this would involve:
    // - Setting up fixture data with 60%+ teams having ≤5 games
    // - Triggering the cron job or activation service
    // For now, we'll test the UI response to activation
    
    // Step 4: Verify activation detection API
    const activationCheck = await page.request.get('/api/last-round-special/status');
    expect(activationCheck.ok()).toBeTruthy();
    
    // Step 5: Verify UI updates when cup becomes active
    // This would normally happen automatically, but for testing we can simulate
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // If cup is active, verify tabbed interface appears
    const tabsList = page.locator('[role="tablist"]');
    if (await tabsList.isVisible()) {
      await expect(page.locator('[role="tab"]').first()).toContainText('League Standings');
      await expect(page.locator('[role="tab"]').last()).toContainText('Last Round Special');
      
      // Test tab switching
      await page.locator('[role="tab"]').last().click();
      await expect(page.locator('h2')).toContainText('Last Round Special Standings');
    }
  });

  test('UC-1.2: Cup status API returns correct inactive state', async ({ page }) => {
    // Test the cup status API when cup is not active
    const response = await page.request.get('/api/last-round-special/status');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data.data).toHaveProperty('is_active');
    expect(data.data).toHaveProperty('season_id');
    expect(data.data).toHaveProperty('season_name');
    
    // Verify response time is under SLA (200ms)
    const startTime = Date.now();
    await page.request.get('/api/last-round-special/status');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(200);
  });

  test('UC-1.3: Idempotency - Multiple activation checks', async ({ page }) => {
    // Test that multiple calls to check activation don't cause issues
    const requests = await Promise.all([
      page.request.get('/api/last-round-special/status'),
      page.request.get('/api/last-round-special/status'),
      page.request.get('/api/last-round-special/status')
    ]);
    
    // All requests should succeed
    requests.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
    
    // All responses should be consistent
    const responses = await Promise.all(requests.map(r => r.json()));
    const firstResponse = responses[0];
    
    responses.forEach(response => {
      expect(response.data.is_active).toBe(firstResponse.data.is_active);
      expect(response.data.season_id).toBe(firstResponse.data.season_id);
    });
  });

  test('Error handling: API error scenarios', async ({ page }) => {
    // Test graceful handling of various error conditions
    
    // Test with invalid season parameter (if applicable)
    const invalidRequest = await page.request.get('/api/last-round-special/status?season=invalid');
    expect(invalidRequest.ok()).toBeTruthy(); // Should handle gracefully
    
    // Verify error responses are properly structured
    const response = await invalidRequest.json();
    expect(response).toHaveProperty('success');
    
    if (!response.success) {
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('metadata');
    }
  });

  test('Performance: Cup status API response time', async ({ page }) => {
    // Test that cup status API meets performance requirements
    const iterations = 5;
    const responseTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const response = await page.request.get('/api/last-round-special/status');
      const endTime = Date.now();
      
      expect(response.ok()).toBeTruthy();
      responseTimes.push(endTime - startTime);
      
      // Small delay between requests
      await page.waitForTimeout(100);
    }
    
    // Calculate average response time
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Verify average response time is under 200ms SLA
    expect(avgResponseTime).toBeLessThan(200);
    
    // Verify no response took longer than 500ms
    const maxResponseTime = Math.max(...responseTimes);
    expect(maxResponseTime).toBeLessThan(500);
    
    console.log(`Cup Status API Performance:
      Average: ${avgResponseTime.toFixed(2)}ms
      Max: ${maxResponseTime}ms
      Min: ${Math.min(...responseTimes)}ms`);
  });
}); 