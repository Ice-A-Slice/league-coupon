# CI/CD Setup for Database Tests

This document describes how the CI/CD pipeline is configured to run tests with a local Supabase environment.

## Overview

The CI/CD pipeline has been configured to support running the full test suite including integration tests that require a database. This setup uses Supabase CLI with Docker to create a local development environment during the CI run.

## Pipeline Configuration

### CI Workflow (`.github/workflows/ci.yml`)

The CI workflow consists of three main jobs:

1. **Lint Job**: Runs ESLint on the codebase
2. **Test Job**: Sets up local Supabase and runs all tests
3. **Build Job**: Builds the application (depends on lint and test passing)

### Test Job Details

The test job performs the following steps:

#### 1. Environment Setup
- Uses `ubuntu-latest` runner
- Sets up Node.js 20 with npm caching
- Verifies Docker installation (pre-installed on ubuntu-latest)

#### 2. Supabase CLI Installation
```bash
curl -fsSL https://github.com/supabase/cli/releases/download/v1.200.3/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

#### 3. Docker Image Caching
- Caches Supabase Docker images based on `supabase/config.toml` hash
- Reduces build time on subsequent runs

#### 4. Local Supabase Startup
```bash
supabase start --exclude=imgproxy,edge-runtime
```
- Starts minimal Supabase services needed for testing
- Excludes unnecessary services to reduce startup time
- Waits for database to be ready using `pg_isready` check

#### 5. Database Setup
- Seeds test data from `supabase/seed.sql` if available
- Runs database reset to ensure clean state
- Verifies database connectivity

#### 6. Test Execution
- Runs Jest tests with 10-minute timeout
- Runs Playwright E2E tests with 15-minute timeout
- Uploads test results as artifacts on failure

#### 7. Cleanup
- Stops Supabase services (runs even if tests fail)

## Environment Variables

### CI/CD Environment Variables

The following environment variables are automatically set during CI:

```bash
# Local Supabase instance URLs and keys
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=test
```

These are the standard local development keys that Supabase CLI uses.

### Production Deployment Variables

For deployment, the following secrets must be configured in GitHub repository settings:

- `NEXT_PUBLIC_SUPABASE_URL`: Production Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Production anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Production service role key
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

## Test Strategy

### Integration Tests
- API route tests (`src/app/api/*/route.test.ts`) run with local Supabase
- Database integration tests use real PostgreSQL instance
- Authentication tests use mock strategy for controlled testing

### Unit Tests
- Component tests use jsdom environment
- Service layer tests mock external dependencies where appropriate
- Utility function tests are pure unit tests

## Deployment Workflow

The deployment workflow (`.github/workflows/deployment.yml`) runs on `main` branch pushes and:

1. Installs dependencies
2. Runs unit tests only (excludes API route tests that need local Supabase)
3. Runs linting
4. Builds the application
5. Deploys to Vercel

The deployment uses production Supabase credentials and skips integration tests to avoid the overhead of setting up local Supabase for deployment validation.

## Caching Strategy

### Docker Images
- Supabase Docker images are cached using GitHub Actions cache
- Cache key based on `supabase/config.toml` content hash
- Reduces startup time from ~2 minutes to ~30 seconds on cache hit

### Node Dependencies
- npm dependencies cached using `actions/setup-node` built-in caching
- Build output cached for potential reuse

### Test Results
- Test artifacts uploaded on failure for debugging
- Playwright reports and screenshots saved for 7 days

## Performance Optimizations

1. **Minimal Supabase Services**: Only essential services started
2. **Parallel Job Execution**: Lint, test, and build can run in parallel where possible
3. **Smart Caching**: Multiple layers of caching to reduce build times
4. **Timeout Management**: Appropriate timeouts to prevent hanging builds
5. **Test Separation**: Unit tests run quickly in deployment, integration tests run in CI

## Troubleshooting

### Common Issues

#### Database Connection Timeouts
If tests fail with database connection errors:
- Check if Supabase startup completed successfully
- Verify Docker containers are running (`docker ps` in workflow)
- Ensure `pg_isready` check passes before tests start

#### Docker Issues
If Docker-related errors occur:
- GitHub Actions runners should have Docker pre-installed
- Check Docker version with `docker --version` step
- Verify sufficient disk space for Docker images

#### Test Failures
If specific tests fail in CI but pass locally:
- Check environment variable differences
- Verify test data seeding completed
- Review uploaded test artifacts for detailed error information

#### Performance Issues
If builds are slow:
- Check cache hit rates in GitHub Actions logs
- Consider reducing Docker image sizes
- Review which Supabase services are actually needed

### Debugging Steps

1. **Check Docker Status**: Review `docker ps` output in workflow logs
2. **Database Connectivity**: Verify `pg_isready` and `supabase db ping` succeed
3. **Environment Variables**: Ensure all required variables are set correctly
4. **Test Artifacts**: Download and review uploaded test results on failure
5. **Local Reproduction**: Try reproducing issues with `supabase start` locally

## Maintenance

### Regular Updates

1. **Supabase CLI Version**: Update version in installation step as needed
2. **Node.js Version**: Keep in sync with local development
3. **GitHub Actions**: Update action versions when available
4. **Docker Images**: Monitor for Supabase Docker image updates

### Monitoring

- Monitor build times and cache hit rates
- Review test execution times for performance regression
- Check artifact upload sizes and cleanup policies
- Monitor GitHub Actions usage and billing impact

## Future Improvements

1. **Matrix Testing**: Test against multiple Node.js versions
2. **Database Migrations**: Add support for running migrations in CI
3. **Parallel Test Execution**: Split tests across multiple runners
4. **Custom Docker Images**: Pre-built images with Supabase CLI
5. **Test Result Analysis**: Automated test result trend analysis 