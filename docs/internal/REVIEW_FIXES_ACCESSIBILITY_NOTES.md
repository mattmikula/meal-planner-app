# Review Fixes and Accessibility Notes (2026-02-06)

This document captures the fixes implemented on branch `codex/review-fixes-best-practices`, what problems they addressed, and why they matter.

The goal is to make the reasoning explicit so you can reuse these patterns as your frontend skills grow, especially around accessibility.

## Change Summary

### 1) Mobile nav drawer accessibility: remove hidden-but-focusable content

- Issue:
  - The mobile drawer content remained mounted in the DOM even when visually hidden.
  - CSS like `transform: translateX(-100%)` and `pointer-events: none` hides pointer interaction but does not remove elements from keyboard tab order.
- Change:
  - The drawer portal is now rendered only when the mobile menu is open.
  - Closed state no longer leaves drawer links/buttons focusable.
- Files:
  - `app/ui/AppNav.tsx`
- Why this is necessary:
  - Keyboard and assistive technology users should not tab into off-screen or hidden UI.
  - This prevents confusing focus jumps and "ghost navigation" states.

### 2) Account dropdown semantics: remove incomplete ARIA menu roles

- Issue:
  - The account dropdown used `role="menu"` and `role="menuitem"` without implementing full menu keyboard behavior (arrow-key navigation, roving focus model, etc.).
- Change:
  - Replaced menu roles with simpler semantic structure (`div` + list + button) and kept native button behavior.
  - Kept Escape and outside-click close behavior.
- Files:
  - `app/ui/AppNav.tsx`
  - `app/ui/AppNav.module.css`
- Why this is necessary:
  - ARIA roles are a contract. If behavior does not match the role, screen reader behavior can become misleading.
  - Native semantics are safer than partially implemented advanced ARIA widgets.

### 3) Remove redundant auth request in nav

- Issue:
  - `AccountMenu` performed an extra `/api/me` call to determine auth state, even on authenticated app pages.
- Change:
  - Removed `isAuthenticated` state and the mount-time auth fetch from `AccountMenu`.
- Files:
  - `app/ui/AppNav.tsx`
- Why this is necessary:
  - Reduces unnecessary client-side network work and improves responsiveness.
  - Keeps nav behavior simpler and avoids an avoidable data-fetch waterfall.

### 4) Internal API error hardening (health + openapi)

- Issue:
  - Internal endpoint failures could return raw internal error messages to clients.
- Change:
  - Added server-side logging with `logApiError(...)`.
  - Returned generic client-safe messages via `jsonError(...)`.
- Files:
  - `app/api/health/route.ts`
  - `app/api/openapi/route.ts`
- Why this is necessary:
  - Even internal endpoints benefit from consistent "no internals leaked" error handling.
  - Keeps operational diagnostics in logs, not in public response bodies.

### 5) Secure cookie handling for logout behind proxies

- Issue:
  - Logout used `new URL(request.url).protocol` directly, which can mis-detect HTTPS when behind a reverse proxy/load balancer.
- Change:
  - Reused `isSecureRequest(request.url, x-forwarded-proto)` in logout route.
- Files:
  - `app/api/logout/route.ts`
- Why this is necessary:
  - Ensures auth cookies are cleared/set with the correct `secure` flag in proxied deployments.
  - Aligns logout behavior with the rest of auth cookie handling.

### 6) Stronger email validation for OTP and invites

- Issue:
  - Validation accepted some strings that were not realistic email formats.
- Change:
  - Added explicit Zod email-format validation in OTP and invite schemas.
- Files:
  - `lib/auth/server.ts`
  - `lib/household/server.ts`
- Why this is necessary:
  - Better alignment with OpenAPI intent (`format: email`).
  - Faster, clearer feedback for invalid user input.

### 7) Typography/copy consistency for loading states

- Issue:
  - Some UI text used `...` instead of typographic ellipsis `…`.
- Change:
  - Normalized relevant household page strings to use `…`.
- Files:
  - `app/household/HouseholdClient.tsx`
- Why this is necessary:
  - Small polish improvement and consistency with UI guidelines used in this codebase.

### 8) Test coverage expansion for previously uncovered route handlers

- Added tests:
  - `tests/api-health-route.test.ts`
  - `tests/api-openapi-route.test.ts`
  - `tests/api-logout-route.test.ts`
  - `tests/api-households-route.test.ts`
  - Extended `tests/auth-otp.test.ts` with invalid-email case.
- Why this is necessary:
  - Converts review findings into regression protection.
  - Keeps endpoint behavior explicit and verifiable.

## Accessibility Deep Dive: Practical Lessons

### A) "Visually hidden" is not the same as "non-interactive"

If content is still mounted and focusable, keyboard users can still reach it.  
Use one of these patterns for closed drawers/modals:

- Unmount when closed.
- Use `hidden` (or `display: none`) so content leaves accessibility tree and tab order.
- Use `inert` for non-active containers when supported/polyfilled.

### B) ARIA roles are behavior contracts

Adding a role like `menu` is not decorative. It implies keyboard behavior and focus rules.  
If you do not need that complexity, native elements (`button`, `ul`, `li`, `a`) are often the best accessibility choice.

Rule of thumb: no ARIA is better than incorrect ARIA.

### C) Keep keyboard escape hatches

Dismissible UI should support:

- Escape to close.
- Click/tap outside to close.
- Predictable focus behavior after close (usually return focus to the trigger).

### D) Keep async feedback in live regions

Status updates are more accessible when exposed via `role="status"` / `aria-live="polite"` so assistive tech can announce changes without abrupt interruption.

## How to Verify These Changes

Run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Manual accessibility checks:

1. Open the app on mobile viewport.
2. Open nav drawer and tab through links.
3. Close drawer and tab again.
4. Confirm focus does not move into closed drawer links.
5. Open account menu and confirm:
   - Escape closes it.
   - Focus returns to account button.
   - Sign out action is reachable and announced as a button.

## Reusable Accessibility PR Checklist

Use this as a quick pass for any UI PR.

- Semantics
  - Interactive actions use `<button>`.
  - Navigation uses `<a>` / `<Link>`.
  - Form controls have associated labels.
  - Heading order is meaningful (`h1` -> `h2` -> `h3`).
- Keyboard behavior
  - All interactive elements are reachable by keyboard.
  - Focus order matches visual order.
  - Escape closes drawers/popovers/modals.
  - Focus returns to the triggering element after close.
- Visibility and focus
  - Hidden/off-screen UI is not keyboard-focusable when closed.
  - `:focus-visible` styles are clearly visible on all controls.
  - No `outline: none` without an equivalent replacement.
- Feedback and errors
  - Async status messages use `role="status"` or `aria-live="polite"`.
  - Validation errors are specific and appear near fields.
  - First invalid field is easy to locate/focus.
- Motion and interaction
  - Motion respects `prefers-reduced-motion`.
  - Animations use `transform`/`opacity` where possible.
  - Touch targets are not too small and are easy to tap.
- Content resilience
  - Long text and long user-generated values do not break layout.
  - Empty states are handled (not blank or broken UI).
- Quick manual smoke test
  - Tab through the whole page once.
  - Shift+Tab back once.
  - Trigger each dismissible UI with keyboard and close it with Escape.
  - Run one screen reader check (VoiceOver/NVDA/JAWS) on the changed flow.
