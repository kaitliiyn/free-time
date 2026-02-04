# Netlify Deployment Setup Guide

This guide will help you configure Supabase for your Netlify deployment so that group functionality and event saving work correctly.

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Name**: free-time (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to your users
5. Click **"Create new project"** and wait 2-3 minutes for it to be created

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** (gear icon in the left sidebar)
2. Click **"API"** in the settings menu
3. You'll see two important values:
   - **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy both values (you'll need them in Step 4)

## Step 3: Create Database Tables

1. In your Supabase project, go to **SQL Editor** (in the left sidebar)
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from this repository
4. Copy the entire contents of that file
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned" - this means the tables were created!

## Step 4: Enable Realtime (Optional - App works without it!)

**Note:** Supabase Realtime may be in private alpha. The app will automatically use polling as a fallback if Realtime is not available.

If Realtime is available in your project:
1. In your Supabase project, go to **Database** → **Replication** (in the left sidebar)
2. Find these tables in the list:
   - `members`
   - `schedules`
3. Toggle the switch to **ON** for both tables (if available)
   - This enables real-time updates so users see changes instantly
   - If you don't see this option or it's disabled, the app will automatically poll for updates every 3 seconds

## Step 5: Configure Environment Variables in Netlify

1. Go to your Netlify dashboard: [https://app.netlify.com](https://app.netlify.com)
2. Select your site (free-time)
3. Go to **Site configuration** → **Environment variables**
4. Click **"Add a variable"** or **"Add environment variable"**
5. Add the first variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: Paste your Project URL from Step 2
   - Click **"Save"**
6. Add the second variable:
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value**: Paste your anon public key from Step 2
   - Click **"Save"**

## Step 6: Redeploy Your Site

After adding the environment variables, you need to trigger a new deployment:

1. In Netlify, go to **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait for the build to complete (usually 1-2 minutes)

Alternatively, if your site is connected to GitHub, you can:
- Make a small commit and push to trigger an automatic deployment
- Or just wait - Netlify will auto-deploy on the next push

## Step 7: Verify It's Working

1. Visit your Netlify site URL
2. You should **NOT** see a yellow warning banner saying "Supabase Not Configured"
3. Try creating a group - it should work!
4. Try adding an event - it should save and appear on the calendar
5. Open the browser console (F12) - you should **NOT** see Supabase configuration warnings

## Troubleshooting

### Still seeing "Supabase Not Configured" banner?
- Double-check that the environment variable names are exactly:
  - `NEXT_PUBLIC_SUPABASE_URL` (with underscores, all caps)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with underscores, all caps)
- Make sure you've redeployed after adding the variables
- Check that the values don't have extra spaces or quotes

### Events not saving?
- Check the browser console (F12) for error messages
- Verify the database tables were created (go to Supabase → Table Editor)
- Make sure Realtime is enabled for the `schedules` table

### Groups not working?
- Verify the `groups` and `members` tables exist in Supabase
- Check that Realtime is enabled for the `members` table
- Look for errors in the browser console

### Still having issues?
1. Check Netlify build logs for any errors
2. Check browser console (F12) for runtime errors
3. Verify your Supabase project is active (not paused)
4. Make sure you copied the correct keys (anon key, not service role key)

## Quick Checklist

- [ ] Supabase project created
- [ ] Database tables created (ran supabase-schema.sql)
- [ ] Realtime enabled for `members` and `schedules` tables
- [ ] Environment variables added in Netlify
- [ ] Site redeployed after adding variables
- [ ] No warning banner on the site
- [ ] Can create groups
- [ ] Can add events
- [ ] Events appear on calendar

