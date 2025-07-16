import { 
  connectToTestDb, 
  truncateAllTables, 
  seedTestData, 
  disconnectDb, 
  resetDatabase 
} from './db';

describe('Database Test Utilities', () => {
  let client: any;

  beforeAll(async () => {
    // Set up test environment variables if not already set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    }
  });

  afterAll(async () => {
    await disconnectDb();
  });

  describe('connectToTestDb', () => {
    it('should successfully connect to the test database', async () => {
      client = await connectToTestDb();
      expect(client).toBeDefined();
      expect(typeof client.from).toBe('function');
    });

    it('should throw error if environment variables are missing', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      await expect(connectToTestDb()).rejects.toThrow(
        'Missing required environment variables'
      );

      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    });
  });

  describe('truncateAllTables', () => {
    beforeEach(async () => {
      client = await connectToTestDb();
    });

    it('should truncate all tables without errors', async () => {
      await expect(truncateAllTables()).resolves.not.toThrow();
    });

    it('should result in empty tables after truncation', async () => {
      // First seed some data
      await seedTestData();
      
      // Verify data exists
      const { data: competitionsBefore } = await client.from('competitions').select('*');
      expect(competitionsBefore?.length).toBeGreaterThan(0);

      // Truncate
      await truncateAllTables();

      // Verify tables are empty
      const { data: competitions } = await client.from('competitions').select('*');
      const { data: seasons } = await client.from('seasons').select('*');
      const { data: teams } = await client.from('teams').select('*');

      expect(competitions?.length).toBe(0);
      expect(seasons?.length).toBe(0);
      expect(teams?.length).toBe(0);
    });
  });

  describe('seedTestData', () => {
    beforeEach(async () => {
      client = await connectToTestDb();
      await truncateAllTables();
    });

    it('should seed test data successfully', async () => {
      await expect(seedTestData()).resolves.not.toThrow();
    });

    it('should create expected test data', async () => {
      await seedTestData();

      // Check competitions
      const { data: competitions } = await client.from('competitions').select('*');
      expect(competitions?.length).toBe(1);
      expect(competitions?.[0].name).toBe('Premier League');

      // Check teams
      const { data: teams } = await client.from('teams').select('*');
      expect(teams?.length).toBe(4);
      expect(teams?.map((t: any) => t.name)).toContain('Arsenal');

      // Note: Profiles are not seeded automatically due to RLS constraints
      // Individual tests should create profiles as needed

      // Check fixtures
      const { data: fixtures } = await client.from('fixtures').select('*');
      expect(fixtures?.length).toBe(3);
      expect(fixtures?.[0].status_short).toBe('FT');
    });
  });

  describe('resetDatabase', () => {
    beforeEach(async () => {
      client = await connectToTestDb();
    });

    it('should reset database with seeding by default', async () => {
      await expect(resetDatabase()).resolves.not.toThrow();

      // Verify data was seeded
      const { data: competitions } = await client.from('competitions').select('*');
      expect(competitions?.length).toBe(1);
      
      const { data: teams } = await client.from('teams').select('*');
      expect(teams?.length).toBe(4);
    });

    it('should reset database without seeding when seed=false', async () => {
      await expect(resetDatabase(false)).resolves.not.toThrow();

      // Verify tables are empty
      const { data: competitions } = await client.from('competitions').select('*');
      expect(competitions?.length).toBe(0);
      
      const { data: teams } = await client.from('teams').select('*');
      expect(teams?.length).toBe(0);
    });
  });

  describe('disconnectDb', () => {
    it('should disconnect without errors', async () => {
      await connectToTestDb();
      await expect(disconnectDb()).resolves.not.toThrow();
    });
  });
});