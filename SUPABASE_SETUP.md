# Supabase Setup Guide

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in your project details and wait for it to be created

## Step 2: Get Your API Keys

1. In your Supabase project, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Step 3: Set Up Environment Variables

1. Create a `.env.local` file in the root of your project (if it doesn't exist)
2. Add the following:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

3. Replace the placeholder values with your actual Supabase credentials

## Step 4: Create Database Tables

1. In your Supabase project, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the contents of `supabase-schema.sql`
4. Click "Run" to execute the SQL

This will create:
- `groups` table - stores group information
- `members` table - stores group memberships
- `schedules` table - stores busy blocks/schedules

## Step 5: Enable Realtime (Optional but Recommended)

1. Go to **Database** → **Replication**
2. Enable replication for:
   - `members` table
   - `schedules` table

This enables real-time updates when data changes.

## Step 6: Restart Your Development Server

After setting up environment variables, restart your Next.js dev server:

```bash
npm run dev
```

## Verification

Once set up, when users join the same group code:
- They will see each other in the "Group Members" list
- They will see each other's busy blocks on the calendar
- Changes will sync in real-time across all users

## Troubleshooting

- **"Supabase environment variables are not set"**: Make sure your `.env.local` file exists and has the correct variable names
- **"Error fetching members"**: Check that you've run the SQL schema and that RLS policies are set correctly
- **No real-time updates**: Make sure Realtime is enabled for the tables in Supabase

