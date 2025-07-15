# Cron Jobs Configuration and Management

This document provides comprehensive information about the automated cron jobs used for season completion detection and winner determination in the League Coupon application.

## Overview

The application uses two main cron jobs to automatically manage season lifecycle:

1. **Season Completion Detection** - Weekly job that checks for completed seasons
2. **Winner Determination** - Daily job that determines winners for completed seasons

## Cron Job Endpoints

### 1. Season Completion Detection

**Endpoint**: `/api/cron/season-completion`  
**Schedule**: `0 2 * * 0` (Every Sunday at 2:00 AM UTC)  
**Purpose**: Detects completed seasons and triggers winner determination

**Features**:
- Detects when all betting rounds in a season are scored
- Marks seasons as complete with timestamp
- Automatically triggers winner determination for newly completed seasons
- Fault-tolerant: winner determination failures don't break season completion
- Comprehensive logging and monitoring

### 2. Winner Determination

**Endpoint**: `/api/cron/winner-determination`  
**Schedule**: `0 3 * * *` (Every day at 3:00 AM UTC)  
**Purpose**: Backup processing for any missed winner determinations

**Features**:
- Processes any completed seasons that don't have winners yet
- Independent of season completion detection
- Detailed error reporting and metrics
- Cache invalidation for updated standings

## Scheduling Configuration

### Vercel Configuration

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/season-completion",
      "schedule": "0 2 * * 0"
    },
    {
      "path": "/api/cron/winner-determination", 
      "schedule": "0 3 * * *"
    }
  ]
}
```

### Environment Variables

You can customize cron job behavior using environment variables:

#### Scheduling

```bash
# Custom schedules (cron expressions)
SEASON_COMPLETION_SCHEDULE="0 2 * * 0"    # Default: Weekly Sunday 2 AM UTC
WINNER_DETERMINATION_SCHEDULE="0 3 * * *"  # Default: Daily 3 AM UTC

# Timezone (affects logging and next execution calculations)
CRON_TIMEZONE="UTC"                        # Default: UTC

# Job control
SEASON_COMPLETION_ENABLED="true"           # Default: true
WINNER_DETERMINATION_ENABLED="true"        # Default: true
```

#### Authentication

```bash
# Required for cron endpoint security
CRON_SECRET="your-secure-secret-here"
```

#### Database

```bash
# Required for database access
POSTGRES_URL="your-database-url"
DATABASE_URL="your-database-url"
```

#### Logging

```bash
# Optional logging configuration
LOG_LEVEL="info"        # Default: info
DEBUG="false"           # Default: false
```

## Timezone Handling

### Supported Timezones

The system supports the following timezones:

- `UTC` (recommended for production)
- `America/New_York`
- `America/Chicago`
- `America/Denver`
- `America/Los_Angeles`
- `Europe/London`
- `Europe/Paris`
- `Europe/Stockholm`
- `Asia/Tokyo`
- `Australia/Sydney`

### Daylight Saving Time (DST)

⚠️ **Important**: Some timezones observe DST, which can affect cron job execution:

- **DST Timezones**: America/*, Europe/* (except UTC)
- **Non-DST Timezones**: UTC, Asia/Tokyo, etc.

**Recommendation**: Use UTC for production to avoid DST-related issues.

### Configuration Validation

The system automatically validates:
- Cron expression syntax
- Timezone validity
- Schedule conflicts
- Environment variable consistency

## Manual Execution

### Season Completion

```bash
# Using curl
curl -X GET "https://your-domain.com/api/cron/season-completion" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or using X-Cron-Secret header
curl -X GET "https://your-domain.com/api/cron/season-completion" \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
```

### Winner Determination

```bash
# Using curl
curl -X GET "https://your-domain.com/api/cron/winner-determination" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Response Format

Both endpoints return structured JSON responses:

### Success Response

```json
{
  "success": true,
  "execution_time_ms": 1234,
  "season_detection_results": {
    "seasons_processed": 5,
    "seasons_completed": 2,
    "season_detection_error_count": 0
  },
  "winner_determination_results": {
    "seasons_processed": 2,
    "total_winners_determined": 3,
    "winner_determination_error_count": 0
  },
  "detailed_results": [...],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Monitoring and Alerting

### Built-in Monitoring

Each cron job includes:
- Execution time tracking
- Success/failure metrics
- Detailed error logging
- Processing statistics

### Health Checks

You can verify cron job functionality by checking:

1. **Endpoint accessibility**: Manual execution should return valid responses
2. **Authentication**: Verify CRON_SECRET is working
3. **Database connectivity**: Check database access
4. **Service dependencies**: Ensure all required services are available

### Logging

Structured logs are generated for:
- Job start/completion
- Processing results
- Errors and warnings
- Performance metrics

Log format:
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Season completion cron job completed",
  "metadata": {
    "execution_time_ms": 1234,
    "seasons_processed": 5,
    "seasons_completed": 2
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Symptoms**: 401 Unauthorized responses
**Solutions**:
- Verify `CRON_SECRET` environment variable is set
- Check header format: `Authorization: Bearer <secret>` or `X-Cron-Secret: <secret>`
- Ensure secret doesn't contain special characters

#### 2. Database Connection Issues

**Symptoms**: 500 errors, database timeout messages
**Solutions**:
- Verify `DATABASE_URL` and `POSTGRES_URL` are correct
- Check database connectivity
- Verify database permissions

#### 3. Schedule Not Executing

**Symptoms**: Jobs not running at expected times
**Solutions**:
- Verify `vercel.json` configuration
- Check Vercel deployment status
- Review Vercel function logs
- Confirm timezone settings

#### 4. Invalid Cron Expressions

**Symptoms**: Configuration validation errors
**Solutions**:
- Use online cron expression validators
- Refer to cron syntax documentation
- Check environment variable format

### Debug Mode

Enable debug logging for troubleshooting:

```bash
DEBUG="true"
LOG_LEVEL="debug"
```

### Manual Testing

Test individual components:

```typescript
import { 
  validateCronSchedule, 
  getCronConfiguration,
  describeCronSchedule 
} from '@/utils/cron/schedule';

// Test cron expression
console.log(validateCronSchedule('0 2 * * 0')); // true

// Get current configuration
const config = getCronConfiguration();
console.log(config);

// Get human-readable description
console.log(describeCronSchedule('0 2 * * 0')); // "Every Sunday at 2:00 AM"
```

## Security Considerations

### Authentication

- Always use a strong, randomly generated `CRON_SECRET`
- Rotate the secret periodically
- Use HTTPS for all cron endpoint calls

### Access Control

- Cron endpoints are protected by secret authentication
- No public access is allowed
- Vercel automatically handles the scheduling

### Data Protection

- All database operations use service role credentials
- Sensitive data is not logged
- Error messages don't expose internal system details

## Performance Optimization

### Database Queries

- Indexes are optimized for season completion queries
- Batch processing for large datasets
- Connection pooling for reliability

### Execution Time

- Typical execution time: 1-5 seconds
- Timeout configured: 30 seconds (Vercel limit)
- Memory usage optimized

### Caching

- Results cached where appropriate
- Cache invalidation after data changes
- Reduced database load

## Deployment

### Environment Setup

1. Set required environment variables
2. Deploy to Vercel
3. Verify cron job configuration
4. Test manual execution
5. Monitor first scheduled runs

### Rollback Procedure

If issues occur after deployment:

1. Check Vercel function logs
2. Verify environment variables
3. Test endpoints manually
4. Rollback to previous deployment if needed
5. Review and fix configuration

## Development

### Local Testing

```bash
# Run tests
npm test src/utils/cron/schedule.test.ts

# Manual endpoint testing
npm run dev
curl http://localhost:3000/api/cron/season-completion \
  -H "X-Cron-Secret: test-secret"
```

### Adding New Cron Jobs

1. Create new endpoint in `/api/cron/`
2. Add authentication middleware
3. Implement business logic
4. Add comprehensive tests
5. Update `vercel.json` configuration
6. Update this documentation

## Support

For issues with cron job configuration or execution:

1. Check this documentation
2. Review Vercel function logs
3. Test manual execution
4. Verify environment variables
5. Contact development team if needed

---

**Last Updated**: January 2024  
**Version**: 1.0 