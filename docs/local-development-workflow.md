# Supabase Local Development and Migration Workflow

This document outlines the standard process for working with the database in this project. Following this workflow ensures that the local development environment, the production database, and the TypeScript types remain synchronized and that all schema changes are version-controlled.

**The Golden Rule:** Never make schema changes directly in the Supabase Studio UI (neither locally nor in production). All schema changes *must* be done through migration files.

---

## 1. Starting Your Development Environment

These are the commands you will run every time you start working on the project.

1.  **Start the Local Database:**
    Open your terminal and run:
    ```bash
    supabase start
    ```
    This command starts the entire Supabase stack in Docker on your machine. It will give you a local API URL, a DB URL, and a Studio URL.

2.  **Start the Next.js App:**
    In a separate terminal window, start the Next.js development server:
    ```bash
    npm run dev
    ```
    Your application will automatically connect to the local Supabase instance thanks to the `.env.local` file.

---

## 2. The Database Schema Change Workflow

Follow these steps every time you need to make a change to the database schema (e.g., add a table, add a column, create an index).

### Step 1: Create a New Migration File

Instead of writing SQL in the UI, you first declare your intent to make a change using the Supabase CLI. Give your change a descriptive name.

```bash
# Example: Add a 'nickname' column to the 'profiles' table
supabase migration new add_nickname_to_profiles
```

This command will create a new, empty SQL file in the `supabase/migrations/` directory with a timestamp and the name you provided.

### Step 2: Write Your SQL in the New File

Open the newly created SQL file in your code editor and write the SQL statements for your change.

*Example (`..._add_nickname_to_profiles.sql`):*
```sql
ALTER TABLE public.profiles
ADD COLUMN nickname TEXT;
```

### Step 3: Test the Change Locally

To apply this change to your local database, run the `db reset` command. This safely wipes your local database and recreates it from scratch, applying all migrations in order.

```bash
supabase db reset
```
This command does the following:
1.  Wipes the local database.
2.  Applies the `00000000000000_initial_schema.sql` migration.
3.  Applies any subsequent migrations, including the one you just created.
4.  Runs the `supabase/seed.sql` file to populate the fresh database with test data.

Your local database now reflects the new schema.

### Step 4: Generate TypeScript Types

After successfully changing your local database schema, you must update the TypeScript types to match. Run the following command:

```bash
supabase gen types typescript --local > src/types/supabase.ts
```

This command inspects your **local** database and overwrites the `src/types/supabase.ts` file with the new, correct types. You can now use the new schema changes (e.g., `profile.nickname`) in your code with full type safety.

### Step 5: Commit and Deploy

1.  **Commit Changes to Git:** Add the new migration file and the updated `src/types/supabase.ts` file to your commit. This is crucial for keeping your project history in sync.
    ```bash
    git add supabase/migrations
    git add src/types/supabase.ts
    git commit -m "feat: Add nickname to profiles"
    ```

2.  **Deploy to Production:** Once your changes have been tested and your pull request is approved, apply the migration to your live production database with one safe command:
    ```bash
    supabase db push
    ```
    This command connects to the production database, checks which migrations have already been run, and executes **only the new ones**.

---

## 3. Managing Test Data

To add or change the default test data for your local environment, simply edit the `supabase/seed.sql` file. The changes will be applied the next time you run `supabase db reset`. Remember that the seed file cannot create authenticated users; you must do that manually in the local Supabase Studio (`http://127.0.0.1:54323`). 