# Real-time Setup for Player Positions

This document explains how to set up real-time functionality for player positions in the Supabase backend.

## Step 1: Execute the SQL Setup

1. Log in to the [Supabase Dashboard](https://app.supabase.com)
2. Navigate to your project
3. Go to the SQL Editor
4. Open and execute the `01_enable_realtime.sql` file in this directory
   - This will set up RLS policies and indexes for better performance
   - Note that some operations require superuser access

## Step 2: Enable Real-time in Supabase Dashboard

Since enabling real-time can't be done directly via SQL, follow these steps:

1. In the Supabase Dashboard, go to **Database → Replication**
2. Find the `players` table in the list
3. Enable real-time for this table
4. Set the real-time mode to **Send all changes**

## Step 3: Verify RLS Policies

1. Go to **Authentication → Policies**
2. Verify that the `players` table has the following policies:
   - `Allow public read access to players`
   - `Allow users to update their own player records`

## Step 4: Test the Setup

To verify the real-time setup is working correctly:

1. Open the game in two browser windows
2. Log in with different accounts in each window
3. Join the same planet in both windows
4. Move one player and verify that the position updates are visible in the other window
5. Check the browser console for realtime subscription log messages

## Troubleshooting

If real-time updates are not working:

1. Check the browser console for error messages
2. Verify that the RLS policies are correctly set up
3. Make sure the `players` table has the necessary columns:
   - `session_id` (text)
   - `planet_name` (text)
   - `position_x`, `position_y`, `position_z` (float)
4. Ensure the Supabase project has the real-time service enabled
5. Check if the client is correctly subscribing to the real-time channel 