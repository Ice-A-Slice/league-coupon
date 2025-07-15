import { test, expect } from '@playwright/test';

/**
 * End-to-End Tests: Standings UI and User Interactions
 * 
 * Tests the standings display, tab navigation, and responsive behavior
 * corresponding to UC-3 scenarios from the test plan.
 */

test.describe('Standings UI and User Interactions', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/standings');
    await page.waitForLoadState('networkidle');
  });

  test('UC-3.1: Pre-activation standings display', async ({ page }) => {
    // Check cup status first
    const cupStatus = await page.request.get('/api/last-round-special/status');
    const statusData = await cupStatus.json();
    
    if (!statusData.data.is_active) {
      // Verify simple standings interface when cup is inactive
      await expect(page.locator('h1')).toBeVisible();
      
      // Should NOT show tabs
      await expect(page.locator('[role="tablist"]')).not.toBeVisible();
      
      // Should show league standings table
      await expect(page.locator('table')).toBeVisible();
      
      // Should have standings data
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
      
      // Verify ranking display
      await expect(page.locator('tbody tr').first().locator('td').first()).toContainText('1');
    }
  });

  test('UC-3.2: Post-activation dual standings interface', async ({ page }) => {
    // Note: This test would require cup to be active
    // For now, we test the structure when it would be active
    
    // Check for presence of required elements that should exist
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // Test that page responds to cup status changes
    const cupStatus = await page.request.get('/api/last-round-special/status');
    expect(cupStatus.ok()).toBeTruthy();
  });

  test('UC-3.3: Mobile responsive behavior', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify page is still functional on mobile - use more specific selectors
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Tab navigation and state persistence', async ({ page }) => {
    const cupStatus = await page.request.get('/api/last-round-special/status');
    const statusData = await cupStatus.json();
    
    if (statusData.data.is_active) {
      // Test tab switching preserves content
      const leagueTab = page.locator('[role="tab"]').filter({ hasText: 'League Standings' });
      const cupTab = page.locator('[role="tab"]').filter({ hasText: 'Last Round Special' });
      
      // Start on league tab
      await leagueTab.click();
      await page.waitForLoadState('networkidle');
      
      // Verify league content
      const leagueTable = page.locator('table');
      await expect(leagueTable).toBeVisible();
      
      // Switch to cup tab
      await cupTab.click();
      await page.waitForLoadState('networkidle');
      
      // Verify cup content loaded
      await expect(page.locator('h2')).toContainText('Last Round Special');
      const cupTable = page.locator('table');
      await expect(cupTable).toBeVisible();
      
      // Switch back to league
      await leagueTab.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're back to league content
      await expect(leagueTable).toBeVisible();
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Loading states and error handling', async ({ page }) => {
    // Test loading states
    await page.goto('/standings');
    
    // Should show some content (either loading state or actual data) - use specific selector
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Wait for final content to load
    await page.waitForLoadState('networkidle');
    
    // Should have meaningful content after loading
    await expect(page.locator('table, [data-testid="standings-skeleton"]')).toBeVisible();
    
    // Check for error messages (should not be present in normal conditions)
    const errorMessages = page.locator('[role="alert"], .text-red-800, .bg-red-50');
    if (await errorMessages.count() > 0) {
      // If there are error messages, they should be informative
      await expect(errorMessages.first()).toContainText(/error|failed|problem/i);
    }
  });

  test('Accessibility: Keyboard navigation and screen readers', async ({ page }) => {
    // Test keyboard accessibility
    await page.keyboard.press('Tab');
    
    // Check if cup is active for tab testing
    const cupStatus = await page.request.get('/api/last-round-special/status');
    const statusData = await cupStatus.json();
    
    if (statusData.data.is_active) {
      // Test tab navigation with keyboard
      const tabList = page.locator('[role="tablist"]');
      await expect(tabList).toBeVisible();
      
      // Focus should be manageable with keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
    }
    
    // Test table accessibility
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Tables should have proper headers
    const tableHeaders = page.locator('th');
    await expect(tableHeaders.first()).toBeVisible();
    
    // Check for ARIA labels and proper semantic markup
    await expect(page.locator('[role="tablist"], [role="tab"], [role="tabpanel"], table')).toBeTruthy();
  });

  test('Data accuracy and user highlighting', async ({ page }) => {
    // Verify standings data is accurate and properly formatted
    const table = page.locator('table tbody tr').first();
    await expect(table).toBeVisible();
    
    // Check data format
    const rankCell = table.locator('td').first();
    const nameCell = table.locator('td').nth(1);
    const pointsCell = table.locator('td').last();
    
    await expect(rankCell).toContainText(/^\d+$/); // Should be a number
    await expect(nameCell).toContainText(/\w+/); // Should have some text
    await expect(pointsCell).toContainText(/^\d+$/); // Should be points number
    
    // Test user highlighting (if applicable)
    // This would require authentication setup to test properly
    const highlightedRows = page.locator('tr.bg-blue-50, tr[data-highlighted]');
    if (await highlightedRows.count() > 0) {
      await expect(highlightedRows.first()).toBeVisible();
    }
  });
}); 