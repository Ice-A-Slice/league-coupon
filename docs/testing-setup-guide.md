# Test Environment Setup Guide

This guide explains how to set up and run the test environment with the local Supabase database.

## Prerequisites

1. **Supabase CLI**: Install the Supabase CLI
   ```bash
   npm install -g supabase
   ```

2. **Docker**: Ensure Docker is installed and running on your system

## Setting Up the Local Test Database

### 1. Start Local Supabase Instance

```bash
# Navigate to your project directory
cd /path/to/your/project

# Start the local Supabase stack
supabase start
```

This will start:
- PostgreSQL database on `localhost:54322`
- Supabase API on `localhost:54321`
- Supabase Studio on `localhost:54323`

### 2. Environment Configuration

The test environment uses `.env.test.local` for configuration:

```bash
# Supabase Local Instance Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Database Connection
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Note**: These are the default local Supabase credentials and are safe to use in development.

### 3. Database Schema

Ensure your local database has the latest schema:

```bash
# Apply migrations to local database
supabase db reset

# Or push current schema
supabase db push
```

## Running Tests

### Unit Tests (with mocks)
```bash
npm test
```

### Integration Tests (with real database)
```bash
# Ensure local Supabase is running first
supabase start

# Run integration tests
npm test -- --testNamePattern="integration"
```

### All Tests
```bash
npm test -- --coverage
```

## Test Database Utilities

The test suite includes utilities in `tests/utils/db.ts`:

- `connectToTestDb()`: Connect to local Supabase instance
- `truncateAllTables()`: Reset all tables to empty state
- `seedTestData()`: Insert predefined test data
- `resetDatabase(seed?)`: Complete database reset with optional seeding
- `disconnectDb()`: Clean disconnection

### Example Usage

```typescript
import { resetDatabase, connectToTestDb } from '../utils/db';

describe('My Integration Test', () => {
  beforeEach(async () => {
    // Reset database before each test
    await resetDatabase(true); // true = seed with test data
  });

  it('should work with real database', async () => {
    const client = await connectToTestDb();
    const { data } = await client.from('profiles').select('*');
    expect(data).toHaveLength(2); // From seeded test data
  });
});
```

## Test Configuration

### Jest Setup

The Jest configuration automatically:
1. Loads test environment variables from `.env.test.local`
2. Sets up database reset for integration tests
3. Provides proper TypeScript and module resolution

### Environment Detection

Tests automatically detect if they should use the real database based on:
- `NODE_ENV=test`
- Supabase URL pointing to `127.0.0.1:54321`
- Test name containing "integration"

## Troubleshooting

### Common Issues

1. **"Connection refused" errors**
   - Ensure `supabase start` is running
   - Check Docker is running
   - Verify ports 54321-54323 are available

2. **Schema mismatch errors**
   - Run `supabase db reset` to sync schema
   - Check if migrations need to be applied

3. **Test timeouts**
   - Database operations may be slow on first run
   - Tests have 30-second timeout configured
   - Check if local Supabase is responding

### Debugging

Enable debug logging:
```bash
DEBUG=true npm test
```

View database logs:
```bash
supabase logs
```

Access Supabase Studio:
```
http://localhost:54323
```

## Best Practices

1. **Test Isolation**: Each test should reset database state
2. **Seed Data**: Use consistent test data for predictable results
3. **Cleanup**: Tests automatically clean up after themselves
4. **Performance**: Integration tests are slower - use sparingly
5. **CI/CD**: Ensure CI environment can run Supabase locally

## Migration from Mocks

When converting mocked tests to integration tests:

1. Remove `.skip()` from test descriptions
2. Replace mock implementations with real database calls
3. Set up test data using `seedTestData()` or custom inserts
4. Update assertions to check actual database state
5. Ensure proper cleanup between tests

Example:
```typescript
// Before (mocked)
it.skip('should create user', async () => {
  mockSupabase.from.mockReturnValue({
    insert: jest.fn().mockResolvedValue({ data: mockUser, error: null })
  });
  // ... test logic
});

// After (integration)
it('should create user integration', async () => {
  await resetDatabase();
  const client = await connectToTestDb();
  
  const { data, error } = await client
    .from('profiles')
    .insert({ id: 'test-user', full_name: 'Test User' });
    
  expect(error).toBeNull();
  expect(data).toBeDefined();
});