# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Next.js App Router source, including pages, layouts, and route handlers (e.g., `app/api`, `app/auth`).
- `lib/` contains shared helpers, such as Supabase client setup in `lib/supabase/`.
- `tests/` holds Vitest specs (currently `tests/api-me.test.ts`).
- `supabase/` stores configuration and SQL migrations (`supabase/migrations/0001_init.sql`).
- `docs/` includes internal planning notes like `docs/internal/BUILD_PLAN.md`.

## Build, Test, and Development Commands
- `pnpm dev`: start the local Next.js dev server.
- `pnpm build`: create a production build.
- `pnpm start`: run the production server after building.
- `pnpm lint`: run Next.js ESLint checks.
- `pnpm test`: run Vitest in CI mode.

## Coding Style & Naming Conventions
- Use TypeScript (strict mode is enabled) and ES modules.
- Prefer the `@/` path alias (configured in `tsconfig.json`) over relative imports.
- Match existing file formatting and naming patterns (`.tsx` for UI, `.ts` for utilities).

## General Engineering Preferences
- Aim to keep cyclomatic complexity low.
- Adhere to single responsibility principle.
- When creating functions: keep arguments small; prefer primitive types

## Input Validation
- **OpenAPI spec is the source of truth**
  - All request/response shapes defined in `docs/api/openapi.yaml`
  - Run `pnpm codegen` after updating OpenAPI spec to regenerate types
  - Generated types live in `lib/api/types.ts`
- **Use Zod for runtime validation, constrained by OpenAPI**
  - Define schemas in the server helper module (e.g., `lib/meals/server.ts`)
  - Constrain schemas to match OpenAPI: `satisfies z.ZodType<components["schemas"]["SchemaName"]>`
  - TypeScript will error if schema drifts from OpenAPI spec
  - Export schemas for use in route handlers
  - Use the `validateRequest` helper from `lib/api/helpers.ts` in routes
- **Schema naming convention:**
  - Create operations: `createEntitySchema`
  - Update operations: `updateEntitySchema`
  - Input types derived from schemas: `type CreateEntityInput = z.infer<typeof createEntitySchema>`
- **Validation error handling:**
  - `validateRequest` returns success/failure discriminated union
  - Always return the first validation error to the client (clear, actionable feedback)
  - Never expose internal errors or stack traces in validation messages

## Component Design Guidelines
- Favor small, specialized components that do one thing well.
- Extract reusable pieces early to keep route segments and pages focused.
- Name components after their intent (e.g., `MealCard`, `PlanSummary`) rather than generic labels.
- Fetch only the data needed for the current view; avoid broad selects or unused fields.
- **Keep components small and focused**
  - Prefer composable subcomponents over large "god components"/pages
  - Optimize for readability, testability, and single-responsibility

## UI Styling & Components
- Use CSS Modules for UI component styling; keep `app/globals.css` limited to tokens and base element resets.
- Shared UI primitives live in `app/ui/` (e.g., `PageLayout`, `AppNav`, `Button`, `Card`, `TextInput`, `TextArea`).
- Shared layout/form helpers live in `app/ui/Layout.module.css` and `app/ui/FormControls.module.css`.
- UI tests use Vitest + React Testing Library with `// @vitest-environment jsdom` and `@testing-library/jest-dom/vitest`.
- Prefer enums for UI status/message strings to avoid hard-coded literals scattered across components.

## Frontend Performance
- **Actively consider re-rendering cost** when changing or adding UI
  - Use React DevTools / Profiler when behavior is unclear.
  - Use memoization intentionally where it reduces re-render churn:
    - `React.memo` for stable, presentational components.
    - `useMemo` for expensive derived values.
    - `useCallback` for stable callbacks passed to memoized children.
  - Avoid passing freshly-created objects/functions deep into the tree unless it's harmless or localized.

## API Route Design
- **Routes are thin HTTP adapters**
  - Handle HTTP concerns: parsing requests, auth, status codes, response formatting
  - Delegate business logic, validation, and database operations to helper modules (e.g., `lib/meals/server.ts`)
  - Typical route structure: auth → validate → business logic function → format response
  - Keep routes focused and easy to read; complex logic belongs in testable helper functions

## Frontend/Backend Separation
- Keep core business rules and validation on the backend so every client shares the same behavior.
- Treat UI components as consumers of backend capabilities; avoid duplicating logic in the frontend.
- When adding new features, update backend routes first, then build UI clients around those APIs.
- Mark server-only modules with `import "server-only"` when they must never ship to the client (secrets, service role keys, Node-only APIs).

## Database & Migrations
- Prefer keeping business logic in application code (API routes, `lib/`) rather than database functions or triggers.
- This reduces the need for schema migrations and makes business logic changes easier to test and deploy.
- Use database functions sparingly—primarily for atomic operations that must run in a single transaction or for security boundaries (e.g., `security definer` functions that enforce auth checks).
- Keep migrations focused on schema changes (tables, columns, indexes, RLS policies) rather than procedural logic.

## Testing Guidelines
- **Write tests alongside functionality**—new features should include corresponding tests
- Tests use Vitest and live in `tests/` with `*.test.ts` naming
- Aim to cover API routes and edge cases (auth failures, invalid inputs)
- Keep each test to **1-2 asserts**
- Test granularity: one test tests one thing
- Use shared setup code as needed
- Run `pnpm test` before opening a PR when touching server logic

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and sentence-case (e.g., "Add scaffold setup").
- Confirm CI steps pass locally before commit/push (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`).
- Do not commit or push changes unless explicitly requested.
- PRs should describe the change, include any relevant issue links, and list validation steps.
- Include screenshots or GIFs for UI changes, plus any new environment steps.

## Security & Configuration Tips
- Use `.env.local` for Supabase credentials; never commit secrets.
- Apply schema updates via `supabase/migrations/` before testing API routes.
- Web auth uses email OTP verification with HttpOnly cookies; keep mobile clients on bearer tokens.
- Only collect as much information as needed for the feature to work. Prefer not to collect something if we don't need it.


# ExecPlans
 
When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation.
