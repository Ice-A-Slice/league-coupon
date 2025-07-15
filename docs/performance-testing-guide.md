# Performance Testing Guide - Last Round Special Feature

## Overview

This guide covers the comprehensive performance testing infrastructure implemented for the Last Round Special feature. The testing suite includes load testing, frontend performance monitoring, database performance tracking, and automated SLA validation.

## Test Architecture

### 1. Performance Testing Tools

- **K6**: JavaScript-based load testing with realistic user scenarios
- **Artillery**: Alternative load testing with YAML configuration
- **Playwright**: Frontend performance and Core Web Vitals measurement
- **Database Monitor**: Real-time database performance tracking
- **System Monitor**: Resource utilization monitoring

### 2. Test Scenarios

#### Light Load (50 concurrent users)
- Duration: 5 minutes
- SLA: P95 < 500ms, P99 < 1000ms
- Error rate: < 1%
- Use case: Normal traffic simulation

#### Moderate Load (200 concurrent users)  
- Duration: 10 minutes
- SLA: P95 < 800ms, P99 < 1500ms
- Error rate: < 2%
- Use case: Peak traffic simulation

#### Heavy Load (500 concurrent users)
- Duration: 15 minutes
- SLA: P95 < 1200ms, P99 < 2000ms
- Error rate: < 5%
- Use case: Stress testing scenario

## Quick Start

### Prerequisites

```bash
# Install K6 (if not already installed)
# macOS: brew install k6
# Windows: choco install k6
# Linux: sudo apt-get install k6

# All other dependencies are installed via npm
npm install
```

### Running Performance Tests

```bash
# Run comprehensive performance test suite
npm run perf:all

# Run specific load scenarios
npm run perf:test:light      # Light load test
npm run perf:test:moderate   # Moderate load test  
npm run perf:test:heavy      # Heavy load test

# Run individual tools
npm run perf:frontend        # Frontend performance only
npm run perf:k6             # K6 load test only
npm run perf:artillery      # Artillery load test only

# Custom scenarios
PERF_BASE_URL=https://staging.tippslottet.com npm run perf:test:light
```

## Test Configuration

### Environment Variables

```bash
# Base URL for testing (default: http://localhost:3000)
PERF_BASE_URL=http://localhost:3000

# Database monitoring
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Test duration overrides
PERF_DURATION_MINUTES=5
PERF_USERS=50
```

### SLA Thresholds

| Metric | Light Load | Moderate Load | Heavy Load |
|--------|------------|---------------|------------|
| P50 Response Time | 200ms | 300ms | 500ms |
| P95 Response Time | 500ms | 800ms | 1200ms |
| P99 Response Time | 1000ms | 1500ms | 2000ms |
| Error Rate | < 1% | < 2% | < 5% |
| Connection Pool | < 80% | < 85% | < 90% |

## Test Coverage

### API Endpoints Tested

1. **Cup Status API** (`/api/last-round-special/status`)
   - Expected response time: < 200ms
   - Validates cup activation status
   - Tests idempotency under load

2. **Cup Standings API** (`/api/last-round-special/standings`)
   - Expected response time: < 500ms
   - Handles both active/inactive states
   - Tests data consistency

3. **Enhanced Standings API** (`/api/standings`)
   - Expected response time: < 500ms
   - Tests tabbed interface data
   - Validates user highlighting

4. **Hall of Fame API** (`/api/hall-of-fame`)
   - Expected response time: < 1000ms
   - Tests complex aggregation queries
   - Validates pagination performance

### Frontend Performance Metrics

1. **Core Web Vitals**
   - First Contentful Paint (FCP): < 1800ms
   - Largest Contentful Paint (LCP): < 2500ms
   - Cumulative Layout Shift (CLS): < 0.1
   - First Input Delay (FID): < 100ms

2. **Loading Performance**
   - Page load time: < 2000ms
   - Time to Interactive: < 3000ms
   - Network requests: < 50 per page
   - Transfer size: < 2MB per page

3. **Interaction Performance**
   - Tab switching: < 200ms
   - Scroll response: < 100ms
   - Click response: < 150ms

### Database Performance Monitoring

1. **Connection Management**
   - Active connections tracking
   - Connection pool utilization
   - Connection wait times

2. **Query Performance**
   - Average query execution time
   - Slow query detection (> 1000ms)
   - Query throughput (queries/second)

3. **Resource Utilization**
   - Memory usage patterns
   - Lock contention monitoring
   - Deadlock detection

## Test Execution Flow

### 1. Pre-Test Phase
- Health check validation
- Environment verification
- Baseline metrics collection

### 2. Test Execution
- Parallel load testing (K6 + Artillery)
- Real-time monitoring activation
- Database performance tracking
- Frontend metrics collection

### 3. Post-Test Analysis
- Results aggregation
- SLA compliance validation
- Report generation (JSON + HTML)
- Recommendations generation

## Result Analysis

### Report Locations

```
test-results/performance/
├── performance-report-TIMESTAMP.json    # Comprehensive test results
├── performance-report-TIMESTAMP.html    # Visual dashboard
├── k6-results-SCENARIO.json            # K6 raw data
├── artillery-results-SCENARIO.json     # Artillery raw data
├── db-performance-TIMESTAMP.json       # Database metrics
├── frontend-performance-TIMESTAMP.json # Frontend metrics
└── frontend-performance-TIMESTAMP.html # Frontend dashboard
```

### Key Metrics to Monitor

1. **Response Time Distribution**
   - P50, P95, P99 percentiles
   - Response time trends over duration
   - Spike detection and analysis

2. **Throughput Metrics**
   - Requests per second
   - Successful vs failed requests
   - Error rate patterns

3. **Resource Utilization**
   - Database connection usage
   - Memory consumption
   - CPU utilization patterns

4. **User Experience**
   - Page load times
   - Interactive response times
   - Visual stability metrics

## Troubleshooting

### Common Issues

1. **Connection Refused Errors**
   ```bash
   # Ensure application is running
   npm run dev
   
   # Check health endpoint
   curl http://localhost:3000/api/health
   ```

2. **High Response Times**
   - Check database connection pool
   - Monitor slow query logs
   - Verify network connectivity

3. **Memory Issues**
   - Monitor Node.js heap usage
   - Check for memory leaks
   - Validate database connection cleanup

### Performance Optimization Tips

1. **Database Optimization**
   - Add indexes for frequently queried fields
   - Optimize complex aggregation queries
   - Implement connection pooling

2. **Frontend Optimization**
   - Enable code splitting
   - Implement lazy loading
   - Optimize image sizes and formats

3. **API Optimization**
   - Implement caching strategies
   - Use compression middleware
   - Optimize payload sizes

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Install K6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start application
        run: |
          npm run build
          npm start &
          sleep 30
      
      - name: Run performance tests
        run: npm run perf:test:light
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: test-results/performance/
```

## Best Practices

### Test Design
- Use realistic user scenarios
- Gradually ramp up load
- Test with production-like data volumes
- Include error scenarios

### Monitoring
- Set up alerts for SLA violations
- Monitor trends over time
- Compare results across versions
- Track performance regressions

### Optimization
- Fix performance issues incrementally
- Validate fixes with targeted tests
- Document optimization decisions
- Monitor production performance

## Next Steps

1. **Expand Test Coverage**
   - Add mobile device testing
   - Include accessibility performance
   - Test with different data volumes

2. **Advanced Monitoring**
   - Implement APM integration
   - Add custom business metrics
   - Monitor real user performance

3. **Automation**
   - Automate performance regression detection
   - Integrate with deployment pipelines
   - Set up performance budgets

For questions or issues, refer to the team documentation or contact the development team. 