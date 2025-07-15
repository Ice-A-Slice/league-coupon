import { test, expect } from '@playwright/test';

/**
 * Simple Behavior Tests - Focus on User Experience
 * 
 * These tests verify what users actually see and can do,
 * without getting caught up in implementation details.
 */

test.describe('User Experience Tests', () => {

  test('User can access standings page', async ({ page }) => {
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // User should see the page loads successfully
    await expect(page).toHaveTitle(/TippSlottet|League|Standings/i);
    
    // User should see standings data
    await expect(page.locator('table')).toBeVisible();
    
    // User should see at least one player
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('Cup status API works correctly', async ({ request }) => {
    const response = await request.get('/api/last-round-special/status');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('is_active');
    
    // Since cup is not active, verify this matches reality
    expect(data.data.is_active).toBe(false);
  });

  test('Enhanced standings API provides correct data', async ({ request }) => {
    const response = await request.get('/api/standings');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('league_standings');
    expect(data).toHaveProperty('cup');
    expect(Array.isArray(data.league_standings)).toBeTruthy();
    
    // Since cup is not active, verify cup status
    expect(data.cup.is_active).toBe(false);
  });

  test('Page displays correctly when cup is not active', async ({ page }) => {
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // Should NOT show tabs (since cup is not active)
    const tabsVisible = await page.locator('[role="tablist"]').isVisible();
    expect(tabsVisible).toBe(false);
    
    // Should show regular standings table
    await expect(page.locator('table')).toBeVisible();
    
    // Should show some form of title/heading
    const hasHeading = await page.locator('h1, h2, h3').count() > 0;
    expect(hasHeading).toBeTruthy();
  });

  test('Mobile experience works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // Basic functionality should work on mobile
    await expect(page.locator('table')).toBeVisible();
    
    // Table should be scrollable/responsive
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('Performance is acceptable', async ({ page, request }) => {
    // API should respond quickly
    const apiStart = Date.now();
    const apiResponse = await request.get('/api/last-round-special/status');
    const apiTime = Date.now() - apiStart;
    
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiTime).toBeLessThan(2000); // 2 seconds max
    
    // Page should load in reasonable time
    const pageStart = Date.now();
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    const pageTime = Date.now() - pageStart;
    
    expect(pageTime).toBeLessThan(10000); // 10 seconds max
  });

  test('User sees meaningful content', async ({ page }) => {
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
    
    // Should see at least one row of standings
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    
    // First row should show position 1
    await expect(page.locator('tbody tr').first()).toContainText('1');
    
    // Should see user names in the table
    const hasUserData = await page.locator('tbody').textContent();
    expect(hasUserData).toBeTruthy();
    expect(hasUserData!.length).toBeGreaterThan(10); // Some meaningful content
  });

}); 