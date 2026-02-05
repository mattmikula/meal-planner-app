# Meal Planner App

Meal Planner is a Next.js + Supabase application for organizing household meals, generating weekly plans, and sharing planning data with household members.

## Features

- Email OTP sign-in flow with Supabase (`/` + `/api/verify-otp`)
- Weekly planner with plan generation and per-day updates (`/planner`)
- Meal management (create, edit, delete) with notes, ingredients, and optional image URL (`/meals`)
- Ingredient-based meal suggestions with quick add to groceries (`/ingredients`)
- Household grocery list management with check/uncheck + CRUD (`/groceries`)
- Household context and switching (`/household`)
- Household invite creation and invite acceptance flow (`/household/invite`, `/invite`)
- API docs from OpenAPI at `/docs` (served by `/api/openapi`)
- Health check endpoint at `/api/health`

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict mode)
- Supabase (Auth + Postgres)
- Zod (runtime validation)
- OpenAPI + generated TypeScript API types
- Vitest + Testing Library

## Requirements

- Node.js `>=20`
- `pnpm`
- A Supabase project (or local Supabase stack) with the migrations applied

## Environment Variables

Copy `.env.local.example` to `.env.local` and set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `INVITE_ACCEPT_URL_BASE` (required for household invite links, example: `http://localhost:3000/invite`)

Optional:

- `LOG_LEVEL` (defaults to `info`)

## Local Setup

1. Install dependencies:
   `pnpm install`
2. Create env file:
   `cp .env.local.example .env.local`
3. Apply SQL migrations in order from `supabase/migrations/`:
   1. `0001_init.sql`
   2. `0002_sharing.sql`
   3. `0003_accept_invite_atomic.sql`
   4. `0004_create_household_with_member.sql`
   5. `0005_enable_rls_core_tables.sql`
   6. `0006_apply_plan_generation.sql`
   7. `0007_extensions.sql`
   8. `0008_ingredient_suggestions.sql`
   9. `0009_household_naming.sql`
4. Start dev server:
   `pnpm dev`

## Scripts

- `pnpm dev`: Start local dev server
- `pnpm build`: Create production build
- `pnpm start`: Start production server
- `pnpm lint`: Run ESLint checks
- `pnpm typecheck`: Run TypeScript checks (`tsc --noEmit`)
- `pnpm test`: Run Vitest in CI mode
- `pnpm codegen`: Regenerate API types from OpenAPI

## API and OpenAPI Workflow

- OpenAPI source of truth: `docs/api/openapi.yaml`
- Generated types: `lib/api/types.ts`
- Regenerate types after API spec changes:
  `pnpm codegen`
- Explore docs in browser:
  - ReDoc UI: `http://localhost:3000/docs`
  - Raw spec: `http://localhost:3000/api/openapi`

## Project Structure

- `app/`: Next.js routes, pages, and API handlers
- `lib/`: server/client helpers and domain logic
- `tests/`: Vitest test suite
- `supabase/migrations/`: SQL schema migrations
- `docs/`: API and internal docs
