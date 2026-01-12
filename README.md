# meal-planner-app

Meal Planner is an app for building a pool of go-to meals and generating weekly plans from that pool. The app is built with Next.js (App Router), and Supabase provides auth + Postgres.

Current state: sharing APIs and invite flow are implemented alongside auth + health checks.

## Setup

1. Install dependencies:
   `pnpm install`
2. Create `.env.local`:
   - Copy `.env.local.example` to `.env.local`
   - Fill in Supabase URL, publishable key, and service role key
3. Apply the schema:
   - Run the SQL migrations in `supabase/migrations` (SQL editor or CLI)
4. Run the app:
   `pnpm dev`

## Health Check

Visit `http://localhost:3000/api/health` to confirm database connectivity.

## Sharing Invites

Household invites return a shareable link that redirects to `/invite` with a query param. Configure
`INVITE_ACCEPT_URL_BASE` in `.env.local` (for example, `http://localhost:3000/invite`) so the API
can build invite links. The invite accept flow calls `POST /api/household/invites/accept` after the
user signs in.
