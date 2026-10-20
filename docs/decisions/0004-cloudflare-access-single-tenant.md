# 0004 — Cloudflare Access is the auth boundary; the Worker re-verifies; one user

**Status:** accepted (2026-10)

## Context

The app holds one person's study data and runs on Cloudflare's free tier. Building sign-in,
sessions and password reset into the app would be the largest piece of code in it and the most
likely to be wrong.

## Decision

Cloudflare Access (email one-time PIN) fronts every hostname. The Worker additionally verifies
the `Cf-Access-Jwt-Assertion` JWT (issuer, audience, RS256) and checks the email against the
`ALLOWED_EMAIL` secret, so a misconfigured Access policy still fails closed. The deployment is
single-tenant: `ALLOWED_EMAIL` holds exactly one address and the `records` table has no user
column. A local-only bypass (`DEV_AUTH_BYPASS`) works for `localhost` requests.

## Consequences

- No auth code in the client beyond handling an expired session (`AuthRequiredError`).
- Sharing the deployment with a second person requires a user column, per-user sequences and
  a new decision record, not a longer email list.
- The PWA manifest and service worker must send credentials so Access cookies reach the Worker.
