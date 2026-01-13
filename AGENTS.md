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

## Component Design Guidelines
- Favor small, specialized components that do one thing well.
- Extract reusable pieces early to keep route segments and pages focused.
- Name components after their intent (e.g., `MealCard`, `PlanSummary`) rather than generic labels.
- Fetch only the data needed for the current view; avoid broad selects or unused fields.
- **Keep components small and focused**
  - Prefer composable subcomponents over large "god components"/pages
  - Optimize for readability, testability, and single-responsibility

## Frontend Performance
- **Actively consider re-rendering cost** when changing or adding UI
  - Use React DevTools / Profiler when behavior is unclear.
  - Use memoization intentionally where it reduces re-render churn:
    - `React.memo` for stable, presentational components.
    - `useMemo` for expensive derived values.
    - `useCallback` for stable callbacks passed to memoized children.
  - Avoid passing freshly-created objects/functions deep into the tree unless it's harmless or localized.

## Frontend/Backend Separation
- Keep core business rules and validation on the backend so every client shares the same behavior.
- Treat UI components as consumers of backend capabilities; avoid duplicating logic in the frontend.
- When adding new features, update backend routes first, then build UI clients around those APIs.
- Mark server-only modules with `import "server-only"` when they must never ship to the client (secrets, service role keys, Node-only APIs).

## Testing Guidelines
- Tests use Vitest and live in `tests/` with `*.test.ts` naming.
- Aim to cover API routes and edge cases (auth failures, invalid inputs).
- Run `pnpm test` before opening a PR when touching server logic.
- Keep each test to **1-2 asserts**
- Test granularity: one test tests one thing.
- Use shared setup code as needed.

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
