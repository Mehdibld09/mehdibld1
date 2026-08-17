---
name: SteamShare security fixes
description: Documents all security vulnerabilities found and fixed in the SteamShare API.
---

## Vulnerabilities found and fixed

### Like/unlike XP farming loop (CRITICAL)
The like endpoint originally gave XP to both the post owner AND the liker. Since unlike deletes the like record, a user could like→unlike→like infinitely to farm XP with no limit.
**Fix:** Only post owner gets XP when their post is liked. Likers earn no XP from liking.
**Why:** Removing liker XP breaks the farming motive entirely without needing a new DB table.
**How to apply:** Any future XP-on-action feature must check whether the action is reversible; if so, do not award XP to the acting user.

### Self-like prevention (HIGH)
No check prevented a user from liking their own posts, earning double XP.
**Fix:** Added `account.userId === userId` guard in POST `/:accountId/like` → 403.

### Comment XP farming (HIGH)
Posting a comment always awarded XP regardless of how many times a user commented on the same account. Post→delete→repost cycled unlimited XP.
**Fix:** XP only awarded when `existingCommentCount.length <= 1` (first comment per user per account).

### Unauthenticated credential lookup (HIGH)
`GET /api/accounts/check-credentials` was a public endpoint accepting Steam username+password as query params and returning whether that combo is in the DB.
**Fix:** Added `requireAuth` middleware.

### SQL injection in admin premium routes (MEDIUM)
`POST /premium/generate-code` and `DELETE /premium/codes/:id` used `sql.raw()` with string interpolation. Admin-only but still dangerous.
**Fix:** Replaced with Drizzle ORM typed `db.insert().values(...)` and `db.update().set(...).where(...)`.

### Profile page freeze (MEDIUM)
React Query retries failed requests 3 times by default. If the API returned a non-200 for a profile, the page appeared frozen for several seconds.
**Fix:** Added `retry: false` to `useGetUser` and `useGetUserAccounts` in `profile.tsx`.

## Workflow restart name
`artifacts/api-server: API Server` — use this exact string with `restartWorkflow()`.

## Second-pass security hardening

### Rate limiter path mismatch
app.ts mounted redeemLimiter on "/api/adlinks" but routes/index.ts mounts as "/api/ad-links". Always verify limiter paths against index.ts route prefixes.
**Why:** Silent failure — limiter exists in code but never runs.

### requireAuth must check ban status
requireAuth only verified session.userId; it never checked if the user was banned. Banned users stayed active for the full session lifetime (30 days).
**Fix:** DB ban check cached in session._banCheckedAt, refreshed every 120s.
**Why:** Any authenticated endpoint is abusable without this gate.

### Session fixation
Login/register must call req.session.regenerate() before setting userId to prevent an attacker from pre-planting a known session ID.

### Upload rate limiting
POST /api/accounts must use express-rate-limit with skip: (req) => req.method !== "POST" so GET routes are not affected.
