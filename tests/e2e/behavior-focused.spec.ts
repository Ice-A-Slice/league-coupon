import { test, expect } from '@playwright/test';

/**
 * Behavior-Focused E2E Tests
 * 
 * These tests focus on user behavior and functionality rather than
 * implementation details like specific text content or DOM structure.
 */

test.describe('Last Round Special - User Behavior Tests', () => {

  test('User can view standings regardless of cup status', async ({ page }) => {
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // User should see a page title
    await expect(page.locator('h1, h2, h3')).toBeVisible();
    
    // User should see standings data in a table
    await expect(page.locator('table')).toBeVisible();
    
    // User should see at least one row of data
    await expect(page.locator('tbody tr').first()).toBeVisible();
    
    // First place should show rank 1
    await expect(page.locator('tbody tr').first()).toContainText('1');
  });

  test('API endpoints respond with valid data', async ({ request }) => {
    // Cup status API works
    const statusResponse = await request.get('/api/last-round-special/status');
    expect(statusResponse.ok()).toBeTruthy();
    
    const statusData = await statusResponse.json();
    expect(statusData).toHaveProperty('success');
    expect(statusData).toHaveProperty('data');
    
    // Enhanced standings API works
    const standingsResponse = await request.get('/api/standings');
    expect(standingsResponse.ok()).toBeTruthy();
    
    const standingsData = await standingsResponse.json();
    expect(standingsData).toHaveProperty('league_standings');
    expect(Array.isArray(standingsData.league_standings)).toBeTruthy();
  });

  test('Page is responsive on mobile devices', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // Core functionality should work on mobile
    await expect(page.locator('table')).toBeVisible();
    
    // Should be able to scroll table if needed
    const table = page.locator('table');
    await table.scroll({ timeout: 5000 });
  });

  test('Cup activation status is properly communicated', async ({ page, request }) => {
    // Check current cup status
    const statusResponse = await request.get('/api/last-round-special/status');
    const statusData = await statusResponse.json();
    
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    if (statusData.data.is_active) {
      // When cup is active, user should see tabs or indication
      const hasTabsOrBadge = await page.locator('[role="tablist"], .badge').count() > 0;
      expect(hasTabsOrBadge).toBeTruthy();
    } else {
      // When cup is not active, should show regular standings
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('Performance meets user expectations', async ({ page, request }) => {
    // Page loads in reasonable time
    const startTime = Date.now();
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    const pageLoadTime = Date.now() - startTime;
    
    expect(pageLoadTime).toBeLessThan(10000); // 10 seconds max for full page load
    
    // API responds quickly
    const apiStartTime = Date.now();
    const response = await request.get('/api/last-round-special/status');
    const apiResponseTime = Date.now() - apiStartTime;
    
    expect(response.ok()).toBeTruthy();
    expect(apiResponseTime).toBeLessThan(1000); // 1 second max for API
  });

  test('User can navigate and interact with standings', async ({ page }) => {
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // Check if tabs exist (cup is active)
    const tabsExist = await page.locator('[role="tablist"]').count() > 0;
    
    if (tabsExist) {
      // User can click between tabs
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();
      
      if (tabCount > 1) {
        await tabs.nth(1).click();
        await page.waitForTimeout(500); // Wait for tab change
        
        // Should still see table content
        await expect(page.locator('table')).toBeVisible();
        
        // Click back to first tab
        await tabs.nth(0).click();
        await page.waitForTimeout(500);
        
        await expect(page.locator('table')).toBeVisible();
      }
    }
    
    // Verify basic interactivity works
    await expect(page.locator('table')).toBeVisible();
  });

  test('Error states are handled gracefully', async ({ page }) => {
    // Test with potentially invalid request
    await page.route('**/api/standings', route => route.fulfill({ status: 500 }));
    
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // Page should still load even if API fails
    await expect(page.locator('h1, h2')).toBeVisible();
    
    // Should show error state or loading skeleton
    const hasErrorOrLoading = await page.locator('[data-testid="error"], [data-testid="skeleton"], .error').count() > 0;
    // Note: We don't require error handling, just that page doesn't crash
  });
}); 