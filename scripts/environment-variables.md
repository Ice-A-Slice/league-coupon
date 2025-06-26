# Environment Variables Configuration

This document outlines all environment variables required for the application.

## Required Environment Variables

### Supabase Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Football API Configuration
```bash
NEXT_PUBLIC_FOOTBALL_API_KEY=your-football-api-key
```

### Email Service Configuration (Resend)
```bash
# Required for production email sending
RESEND_API_KEY=your-resend-api-key

# Set to 'true' for development/testing (emails won't actually be sent)
EMAIL_TEST_MODE=true
```

### Security & Cron Jobs
```bash
CRON_SECRET=your-cron-secret
MANUAL_SYNC_SECRET=your-manual-sync-secret
```

### Application Configuration
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Development Configuration
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## Email Service Setup

To configure the email service:

1. **Development Mode**: Set `EMAIL_TEST_MODE=true` to simulate email sending without actual API calls
2. **Production Mode**: 
   - Get a Resend API key from [resend.com](https://resend.com)
   - Set `RESEND_API_KEY=your-actual-api-key`
   - Remove or set `EMAIL_TEST_MODE=false`

## Environment File Setup

Create a `.env.local` file in your project root with the above variables:

```bash
# Copy this to .env.local and fill in your actual values
cp scripts/environment-variables.md .env.example
```

**Important**: Never commit your actual environment variables to version control. The `.env.local` file is already in `.gitignore`. 