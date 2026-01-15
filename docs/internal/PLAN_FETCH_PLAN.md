# Implement Plan Fetch (0.11.0)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This document must be maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

Enable clients to fetch a weekly meal plan by date so the web app and iOS app can reliably display a calendar week, even when no plan exists yet. After this change, a signed-in client can call `GET /api/plans?weekStart=YYYY-MM-DD` and receive a plan with exactly seven plan-day entries; if the plan does not exist, the API creates it and its seven empty days first. You can see it working by starting the dev server, hitting the endpoint with a valid auth token, and confirming the response includes the normalized Monday `weekStart` plus seven `days` entries in ascending date order.

## Progress

- [x] (2026-01-15 14:48Z) Drafted ExecPlan for the `plan-fetch` build step (0.11.0) from `docs/internal/BUILD_PLAN.md`.
- [x] (2026-01-15 15:38Z) Updated OpenAPI for plan fetch, added schemas, and regenerated API types via `pnpm codegen`.
- [x] (2026-01-15 15:38Z) Added plan-fetch server helpers (validation, normalization, fetch-or-create logic) in `lib/plans/server.ts`.
- [x] (2026-01-15 15:38Z) Implemented `GET /api/plans` route and wired auth, validation, and response mapping.
- [x] (2026-01-15 15:38Z) Added API tests for `GET /api/plans` and ran `pnpm test`.
- [x] (2026-01-15 16:32Z) Added plan server validation/normalization tests to cover critical weekStart paths.
- [x] (2026-01-15 16:38Z) Added plan server tests to cover plan creation and day upserts.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Return a `Plan` object with nested `days` entries instead of separate `plan` and `days` fields.
  Rationale: The endpoint is scoped to a single week, and a single response object keeps the API simple for clients.
  Date/Author: 2026-01-15 / Codex
- Decision: Normalize `weekStart` to the Monday of the provided week using UTC date math.
  Rationale: The build plan requires Monday normalization and UTC date math avoids time zone drift when translating `YYYY-MM-DD`.
  Date/Author: 2026-01-15 / Codex
- Decision: Use idempotent inserts (unique constraints + upserts) for plan days.
  Rationale: Repeat calls to the endpoint should be safe and should not create duplicate plan-day rows.
  Date/Author: 2026-01-15 / Codex
- Decision: Validate query parameters as a structured object rather than a raw string.
  Rationale: Object-based validation matches the overall API validation style and makes it easier to add new query parameters later.
  Date/Author: 2026-01-15 / Codex

## Outcomes & Retrospective

Plan fetch is implemented end-to-end with OpenAPI schemas, server-side normalization, and route handling. API tests validate the endpoint and the full test suite passes. Manual verification with `pnpm dev` and a real auth token remains available for local validation.

## Context and Orientation

API routes live under `app/api` and follow the thin HTTP adapter pattern used by `app/api/meals/route.ts`: routes handle auth, request parsing, and HTTP responses, while server helpers in `lib/` contain validation and business logic. OpenAPI is the source of truth in `docs/api/openapi.yaml`, and the generated TypeScript types live in `lib/api/types.ts` (regenerated with `pnpm codegen`). The database tables for this feature already exist in `supabase/migrations/0001_init.sql` and `supabase/migrations/0002_sharing.sql`: `plans` stores one row per household/week (`week_start` date), and `plan_days` stores seven rows per plan with `date` (DATE), `meal_id` (nullable), and `locked` (boolean). `ensureHouseholdContext` in `lib/household/server.ts` supplies the household ID for the authenticated user, and `createServerSupabaseClient` creates a server-side Supabase client using the service role key.

In this plan, “weekStart” means a date string in `YYYY-MM-DD` format that represents the Monday at the start of the plan week. If a client passes a date that is not a Monday, the API will normalize it to the Monday of that week before reading or creating the plan.

## Plan of Work

Update `docs/api/openapi.yaml` to replace the `/api/plans` placeholder with a `GET` definition that requires a `weekStart` query parameter (format `date`) and returns a `Plan` response. Add new component schemas for `PlanWeekStart`, `PlanDay`, and `Plan` in the `components.schemas` section. `Plan` should include `id`, `weekStart`, `createdAt`, `createdBy`, optional `updatedAt`/`updatedBy`, and a `days` array of `PlanDay` objects. `PlanDay` should include `id`, `planId`, `date`, `mealId` (nullable), `locked`, `createdAt`, `createdBy`, and optional `updatedAt`/`updatedBy`. Include 400, 401, and 500 error responses using the shared `Error` schema. After editing the OpenAPI file, run `pnpm codegen` so `lib/api/types.ts` reflects the new endpoint and schemas.

Create a new server helper module at `lib/plans/server.ts` (mark it with `import "server-only"`). Define a Zod schema for `weekStart` that satisfies `components["schemas"]["PlanWeekStart"]`. The schema should enforce `YYYY-MM-DD` format, reject invalid calendar dates (for example, `2024-02-30`), and emit clear error messages for missing or invalid input. Implement a `normalizeWeekStart` helper that accepts a valid date string, converts it to a UTC date, and returns the Monday of that week as a `YYYY-MM-DD` string. Add a helper that builds the seven sequential dates starting from the normalized Monday.

In the same module, add a `fetchPlanForWeek` helper that receives a Supabase client, `householdId`, `userId`, and `weekStart`. It should normalize the date, look up a plan row by `household_id` and `week_start`, and create one if missing (setting `created_at` and `created_by`). Then ensure exactly seven `plan_days` exist for the plan by inserting any missing dates with `meal_id` null, `locked` false, and `created_by` set to the current user. Use the `plan_id` + `date` unique constraint with upsert semantics to keep the operation idempotent. Finally, load the plan and its days (ordered ascending by date) and map database columns to the API shape with camelCase fields.

Implement the route handler in `app/api/plans/route.ts` following the meals API pattern. The route should authenticate with `requireApiUser`, parse `weekStart` from the query string, validate it with `validateRequest` and the Zod schema, call `ensureHouseholdContext` to obtain the household ID, and then call `fetchPlanForWeek`. Return the plan as JSON, apply auth cookies with `applyAuthCookies`, and handle errors with `jsonError` messages that do not leak internal details.

Add a new test file `tests/api-plans.test.ts` to cover `GET /api/plans` behavior. Mirror the structure used in `tests/api-meals.test.ts`: verify unauthorized responses are returned as-is, invalid or missing `weekStart` returns 400 with the schema’s error message, a valid request returns the plan payload, and auth cookies are set when a session is present. Mock `lib/plans/server.ts` in route-level tests to keep the focus on HTTP behavior, and add a small unit test (optional but recommended) for `normalizeWeekStart` in a new `tests/plans-utils.test.ts` if you want coverage of date normalization edge cases.

## Concrete Steps

Run these commands from the repository root (`/workspaces/meal-planner-app`) as you implement the plan:

    rg -n "/api/plans" docs/api/openapi.yaml
    rg --files app/api
    rg -n "plan_days|plans" supabase/migrations/0001_init.sql supabase/migrations/0002_sharing.sql
    pnpm codegen
    pnpm test

Expected output examples (trimmed):

    578:  /api/plans:

After implementation, `rg --files app/api` should include `app/api/plans/route.ts` and `pnpm test` should exit with status 0.

## Validation and Acceptance

Run `pnpm test` and expect the new `tests/api-plans.test.ts` to pass along with the existing suite. For manual verification, start the dev server with `pnpm dev` and issue a request such as:

    curl -i "http://localhost:3000/api/plans?weekStart=2024-02-14" \
      -H "Authorization: Bearer <token>"

The response should return HTTP 200 and JSON containing a `weekStart` normalized to the Monday of that week (for 2024-02-14 this is 2024-02-12) plus exactly seven `days` entries with ascending `date` values. Requests missing `weekStart` or using an invalid date string should return a 400 with the first validation error message. If the same request is repeated, the plan should be reused rather than duplicated.

## Idempotence and Recovery

The plan-fetch operation should be safe to repeat because it relies on unique constraints and upsert semantics for plan days. If an insert fails mid-way (for example, due to a transient DB issue), re-running the request should fill in any missing rows without duplicating existing ones. No migrations are required for this step, so no schema rollback is needed.

## Artifacts and Notes

Example response shape (trimmed):

    {
      "id": "plan-uuid",
      "weekStart": "2024-02-12",
      "createdAt": "2024-02-10T09:00:00Z",
      "createdBy": "user-uuid",
      "updatedAt": null,
      "updatedBy": null,
      "days": [
        {
          "id": "plan-day-uuid-1",
          "planId": "plan-uuid",
          "date": "2024-02-12",
          "mealId": null,
          "locked": false,
          "createdAt": "2024-02-10T09:00:00Z",
          "createdBy": "user-uuid",
          "updatedAt": null,
          "updatedBy": null
        }
      ]
    }

## Interfaces and Dependencies

In `lib/plans/server.ts`, define the following exports and keep them aligned with OpenAPI types:

    import "server-only";
    import { z } from "zod";
    import type { components } from "@/lib/api/types";
    import { createServerSupabaseClient } from "@/lib/supabase/server";

    type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

    export type PlanDay = components["schemas"]["PlanDay"];
    export type Plan = components["schemas"]["Plan"];

    export const planWeekStartSchema: z.ZodType<components["schemas"]["PlanWeekStart"]>;

    export function normalizeWeekStart(weekStart: string): string;

    export async function fetchPlanForWeek(
      supabase: SupabaseClient,
      householdId: string,
      userId: string,
      weekStart: string
    ): Promise<Plan>;

In `app/api/plans/route.ts`, define:

    export async function GET(request: Request): Promise<Response>;

The route should call `requireApiUser`, `ensureHouseholdContext`, `validateRequest` (with `planWeekStartSchema`), `fetchPlanForWeek`, and `applyAuthCookies`, returning errors via `jsonError`.

Plan update 2026-01-15: Initial ExecPlan draft created for the `plan-fetch` (0.11.0) build step so implementation can proceed with a self-contained guide.
Plan update 2026-01-15: Marked implementation steps complete after updating OpenAPI, adding the plan server helper and route, and running `pnpm test`.
Plan update 2026-01-15: Switched plan-fetch query validation to use an object-based schema to align with API validation patterns.
Plan update 2026-01-15: Added targeted plan server tests for weekStart validation and normalization.
Plan update 2026-01-15: Added fetchPlanForWeek coverage for plan creation and missing-day upserts.
