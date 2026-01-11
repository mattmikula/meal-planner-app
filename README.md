# meal-planner-app

Meal Planner is an app for building a pool of go-to meals and generating weekly plans from that pool. The app is built with Next.js (App Router), and Supabase provides auth + Postgres.

Current state: initial scaffold is in place (schema migration + health check endpoint).

## Setup

1. Install dependencies:
   `pnpm install`
2. Create `.env.local`:
   - Copy `.env.local.example` to `.env.local`
   - Fill in Supabase URL, publishable key, and service role key
3. Apply the schema:
   - Run `supabase/migrations/0001_init.sql` in Supabase (SQL editor or CLI)
4. Run the app:
   `pnpm dev`

## Health Check

Visit `http://localhost:3000/api/health` to confirm database connectivity.
