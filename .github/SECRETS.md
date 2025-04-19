# GitHub Actions Secrets

This document explains the secrets you need to set up for deployment using GitHub Actions.

## Required Secrets for CI/CD

No secrets are required for basic CI (linting, testing, and building).

## Vercel Deployment Secrets

If you're deploying to Vercel, you need to set the following secrets:

- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

### How to get Vercel secrets:

1. Go to [Vercel dashboard](https://vercel.com/dashboard)
2. Navigate to Settings → Tokens to create a new token
3. For org and project IDs, run `vercel link` locally and check the `.vercel/project.json` file

## How to Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click on "New repository secret"
4. Add the name and value for each required secret

## Environment Variables

If your application requires environment variables for the deployment, you should:

1. Add them to your hosting platform (Vercel/Netlify) as environment variables
2. For local testing, use a `.env.local` file (make sure it's in your `.gitignore`) 