# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository. Keep changes consistent with the conventions below.

## Overview

Presensa is a self-hosted attendance app: **Next.js 16 App Router + TypeScript**, **Drizzle ORM + mysql2**, **Tailwind v4 + shadcn/ui**, **Sharp** for photos, **S3-compatible** storage. Modular monolith — one app, one Docker image.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build (must pass before shipping)
npm run lint         # ESLint (must be clean)
npx tsc --noEmit     # type-check (must be clean)
npm run db:generate  # generate a migration after editing src/database/schema/*
```

Always run **`npx tsc --noEmit` and `npm run lint`** after changes; run `npm run build` for anything non-trivial. All three must pass.

## Layout

```
src/
  app/                    # App Router
    (auth)/login/         # login (server page reads branding → client LoginForm)
    (setup)/setup/        # first-run wizard (locks after completion)
    account/              # self-service change password (any authed user)
    admin/                # admin panel (AdminShell layout, role-gated)
    employee/             # employee dashboard (camera + geolocation)
    api/                  # route handlers
  components/ui/          # button, card, input, label, select, table, badge, skeleton, alert
  components/             # admin-shell, sign-out-button, location-picker (Leaflet, ssr:false)
  database/
    schema/               # 12 Drizzle tables — EDIT HERE, then db:generate
    migrations/           # generated SQL; runs automatically on startup
  lib/
    auth/                 # session, password (argon2), guard (requireAdmin/requireRole), proxy
    attendance.ts         # location eval, LATE detection, enforceLocation policy
    crypto.ts             # AES-256-GCM encrypt/decrypt using APP_SECRET
    audit.ts              # writeAuditLog (auto-redacts secrets)
    validation.ts         # parseBody(request, zodSchema)
    settings.ts           # getBranding / getAppName / getLanguage (from DB)
    i18n/                 # dictionaries (en/id), provider (useT), server translate()
```

## Conventions (follow these)

- **API auth:** every `/api/admin/*` handler starts with `const guard = await requireAdmin(); if (guard.response) return guard.response;` (or `requireRole(CONFIG_ROLES)` for settings/storage). Never rely on the proxy alone.
- **Input validation:** parse bodies with `parseBody(request, schema)` (Zod). Return its `response` on failure.
- **Drizzle WHERE:** combine conditions with `and(eq(...), eq(...))` — **never** JavaScript `&&`. Always scope queries by `organizationId`.
- **Deletes are soft:** set `isActive = false` (employees/offices/shifts/schedules), never hard-delete. Reactivate via PATCH `isActive: true`.
- **Audit:** call `writeAuditLog({...})` from mutating routes. Secret-bearing keys are redacted automatically; never log passwords/keys yourself.
- **Secrets:** encrypt storage credentials with `encryptSecret` (from `crypto.ts`); never return secret values to the client (mask them).
- **i18n:** all user-facing strings go through `useT()` (client) or `translate(locale, key)` (server). Add keys to **both** `en` and `id` in `src/lib/i18n/dictionaries.ts`. The setup wizard is intentionally English-only (runs pre-config).
- **Tailwind v4:** the type scale uses the `--text-*` / `--font-*` namespaces in `globals.css`. Spacing utilities are real Tailwind steps (`p-4` = 16px) — do **not** write pixel values as the number (`p-16` ≠ 16px).
- **Native modules:** `sharp`, `@node-rs/argon2`, `mysql2` are in `serverExternalPackages` (next.config.ts). Leaflet is loaded via `dynamic(..., { ssr: false })`.

## Attendance model (important)

- Location is enforced in `enforceLocation()` — out-of-radius, low GPS accuracy, or missing location is **rejected (HTTP 422)** and not recorded. When no offices exist, enforcement is skipped.
- Because of that, only `PRESENT` and `LATE` statuses are produced by check-in/out. `MANUAL` / `REJECTED` are set by admin manual correction. (`OUTSIDE_LOCATION` / `LOW_GPS_ACCURACY` were removed from the enum.)
- Schedules are day-of-week based: `schedules.daysOfWeek` is a CSV of `0..6` (0 = Sunday).

## Database & migrations

- Edit `src/database/schema/*`, then run `npm run db:generate`. Review the generated SQL in `src/database/migrations/` — it must be **non-destructive** (add columns with safe defaults; avoid dropping data).
- Migrations run on container startup via `instrumentation.ts` → `migrate.ts`. A failed migration exits the process.

## Gotchas

- `.env` holds real credentials and is gitignored — never commit it.
- The Dockerfile builder does a full `npm ci` (with scripts) so Sharp/argon2 native binaries build; the runner uses Next standalone output plus the copied `public/` and `src/database/migrations`.
- Branding (`getBranding`) falls back to bundled `public/logo.png` and `public/favicon.ico` when no custom image is set; the login page is `force-dynamic` so branding stays live.
