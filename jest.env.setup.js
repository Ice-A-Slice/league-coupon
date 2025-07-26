// Jest environment setup - loads test environment variables before tests run
// This file is executed before jest.setup.cjs

const path = require('path');
const dotenv = require('dotenv');

// Load test environment variables
const testEnvPath = path.resolve(process.cwd(), '.env.test.local');
dotenv.config({ path: testEnvPath });

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

console.log('[JEST_ENV] Test environment variables loaded from .env.test.local');
console.log('[JEST_ENV] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[JEST_ENV] Node environment:', process.env.NODE_ENV);