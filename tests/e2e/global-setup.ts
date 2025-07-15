import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup for Last Round Special E2E Tests
 * 
 * This setup runs once before all tests and prepares the test environment
 * with necessary test data and authentication.
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for Last Round Special E2E tests...');
  
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the application to be ready
    await page.goto(baseURL!);
    await page.waitForLoadState('networkidle');
    
    // Verify core services are running
    console.log('✓ Application is accessible');
    
    // Check API health endpoints
    const healthResponse = await page.request.get(`${baseURL}/api/health`);
    if (!healthResponse.ok()) {
      throw new Error(`Health check failed: ${healthResponse.status()}`);
    }
    console.log('✓ API health check passed');
    
    // Verify database connectivity
    const standingsResponse = await page.request.get(`${baseURL}/api/standings`);
    if (!standingsResponse.ok()) {
      throw new Error(`Standings API failed: ${standingsResponse.status()}`);
    }
    console.log('✓ Database connectivity verified');
    
    // Set up test data state verification
    await setupTestDataValidation(page, baseURL!);
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function setupTestDataValidation(page: any, baseURL: string) {
  // Verify we have test users available
  const playersResponse = await page.request.get(`${baseURL}/api/players`);
  if (!playersResponse.ok()) {
    console.warn('⚠️  Players API not accessible, some tests may fail');
  }
  
  // Check if we have fixture data
  const fixturesResponse = await page.request.get(`${baseURL}/api/fixtures`);
  if (!fixturesResponse.ok()) {
    console.warn('⚠️  Fixtures API not accessible, some tests may fail');
  }
  
  // Verify cup status endpoint is working
  const cupStatusResponse = await page.request.get(`${baseURL}/api/last-round-special/status`);
  if (!cupStatusResponse.ok()) {
    throw new Error('Cup status API is not accessible - this is required for testing');
  }
  
  console.log('✓ Test data validation completed');
}

export default globalSetup; 