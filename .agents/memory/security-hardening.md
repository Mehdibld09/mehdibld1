---
name: Security hardening decisions
description: All security patches applied and the reasoning behind each one.
---

## Email domain whitelist
Only approved mainstream email providers are allowed on registration. The whitelist is in `ALLOWED_EMAIL_DOMAINS` in `artifacts/api-server/src/routes/auth.ts`.

**Why:** Disposable/throwaway email providers let attackers create and abandon accounts with no traceability.

## IP tracking
- `last_login_ip` and `last_login_at` added to `usersTable` schema (pushed via drizzle push).
- Login endpoint updates both fields on every successful login.
- Admin `/admin/users` endpoint returns both fields + `email` + `displayName` + `registrationIp`.
- Admin panel users table: click any row to expand — shows email, reg IP, last login IP, last login time, joined date, premium, avatar URL.

## SSRF via avatar URL
Avatar URLs targeting cloud metadata, private IP ranges, localhost, or local domains are blocked by the avatar update validation.

## XP farming
Self-likes blocked. Like/unlike loop now only grants XP on first like (not on unlike). Comment XP capped per post per user.

## Ban bypass
`requireAuth` now async — checks ban status every 2 min via `_banCheckedAt` cache on session.

## Session fixation
`req.session.regenerate()` called on both login and register.

## IP ban system
- New `ip_bans` table: `id`, `ip` (unique), `reason`, `banned_by_user_id`, `created_at`.
- Banning a user auto-bans their `registration_ip` and `last_login_ip` via `onConflictDoNothing`.
- Unbanning a user auto-removes the IP bans for their IPs.
- Login and register both check `ip_bans` before proceeding — returns 403 if IP is banned.
- Admin `IP Bans` tab: manually add/remove IPs, see full list.

## VPN/proxy blocking on registration
- `artifacts/api-server/src/lib/ipCheck.ts` — `isVpnOrProxy(ip)` uses ip-api.com free API.
- Checks `proxy` and `hosting` fields; results cached 1 hour in memory.
- Only applied on registration (not login — too strict for existing users).
- Fails open (allows through) if ip-api.com is down/rate-limited — never blocks legit users due to API failure.

## Mandatory email 2FA for sensitive account actions
- New registrations require a short-lived, one-time email code before activation; email delivery failures fail closed rather than auto-verifying.
- Password changes validate the current password first, then require a separate email code before committing the bcrypt hash.
- Codes are bcrypt-hashed; registration/login codes use the user record, while password-change codes and the pending password hash stay session-bound to prevent concurrent-flow collisions.

**Why:** Registration and password changes are account-takeover surfaces; silently bypassing a required email challenge or sharing challenge state across flows would weaken the security guarantee.

**How to apply:** Keep challenge identity and pending operations server-derived, clear one-time state after success, expire challenges quickly, and never put raw codes or plaintext passwords in storage.

## Cross-subdomain admin sessions
When the public site and admin console use different subdomains, configure the session cookie with their shared parent domain through `SESSION_COOKIE_DOMAIN`; leave it unset for host-only preview cookies.

**Why:** A host-only session cookie is not sent when the user follows an admin link to another subdomain, forcing an unnecessary second login.

**How to apply:** Set the production value to the parent domain with a leading dot, such as `.steamfamily.gg`, and keep the same session secret and database behind both hosts.
