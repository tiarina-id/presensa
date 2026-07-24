<div align="center">
  <img src="public/logo.png" width="88" alt="Presensa logo" />
  <h1>Presensa</h1>
  <p><strong>Open-source, self-hosted attendance with location + photo verification.</strong></p>
  <p>
    <a href="#license"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" /></a>
    <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black.svg" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg" />
  </p>
</div>

Presensa lets organizations record employee attendance verified by **GPS location within an office radius**, a **check-in/out photo**, and **server-side time**. It ships as a **single Docker image** — bring your own MySQL-compatible database and S3-compatible object storage; everything else is configured through the web UI.

---

## Features

- **Location-verified check-in/out** — Haversine distance against configurable office radius; out-of-radius or low-GPS-accuracy attempts are rejected server-side.
- **Photo capture** — front-camera selfie, processed with Sharp (auto-rotate, resize, EXIF-stripped, converted to WebP) before upload.
- **Shifts & day-of-week schedules** — assign an employee a shift on any set of weekdays; automatic `LATE` detection against the shift start + tolerance.
- **Reports & monthly recap** — per-employee summary (present / late / absent / total hours) with CSV export.
- **Admin panel** — employees, offices (map picker), shifts, schedules, audit log, branding.
- **Branding** — custom app name, logo, and favicon (stored in the database); English / Bahasa Indonesia UI.
- **Security** — Argon2id passwords, HTTP-only session cookies with server-side expiry, role-based access, S3 credentials encrypted at rest (AES-256-GCM), redacted audit logging.
- **First-run setup wizard** — creates the admin, organization, first office, and storage config; locks after completion.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui on `@base-ui/react`, Geist font |
| Database | MySQL 8.x / 8.4 LTS / MariaDB-compatible via Drizzle ORM + `mysql2` |
| Auth | Cookie sessions + Argon2id (`@node-rs/argon2`) |
| Photos | Sharp → WebP, S3-compatible storage (AWS SDK v3) |
| Maps | Leaflet + OpenStreetMap |
| Validation | Zod |
| Deployment | Single multi-stage Docker image (amd64 / arm64) |

## Quick start (Docker)

```bash
docker run -d \
  --name presensa \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://presensa:password@db-host:3306/presensa?sslmode=require" \
  -e APP_SECRET="$(openssl rand -hex 32)" \
  ghcr.io/your-org/presensa:latest
```

On startup the container validates the environment, tests the database connection, runs pending migrations, and serves the app. Open `http://localhost:3000` — you'll be redirected to the **setup wizard** on first run.

> You need a running MySQL-compatible database. Presensa does not bundle one and does not ship a Docker Compose file.

## Configuration

Only two environment variables are required — everything else lives in the database and is edited from the admin UI.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | `mysql://user:pass@host:3306/db?sslmode=<mode>` |
| `APP_SECRET` | ✅ | Long random string; also the key for encrypting stored secrets. Min 16 chars (32+ recommended). |
| `APP_URL` | — | Public URL; auto-detected from the request if omitted. |
| `DATABASE_SSL_CA_FILE` | — | Path to a PEM CA file for `verify-ca` / `verify-full`. |

**Supported `sslmode` values:** `disable`, `preferred`, `require`, `verify-ca`, `verify-full`.

Storage (S3 / R2 / MinIO / Wasabi / B2 / Spaces), attendance rules, branding, and language are all configured under **Admin → Settings**.

## Development

```bash
npm install
cp .env.example .env          # edit DATABASE_URL and APP_SECRET
npm run db:generate           # regenerate migrations after schema changes
npm run dev                   # http://localhost:3000
```

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (Next standalone output) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:studio` | Drizzle Studio |

Migrations run automatically on startup; you never invoke them manually in production.

## Health check

```
GET /api/health  →  { "status": "ok", "database": "connected", "storage": "configured" }
```

## Roles

`SUPER_ADMIN`, `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`. Permission checks are enforced in the API layer, independent of the UI.

## Contributing

Issues and pull requests are welcome. Please run `npm run lint` and `npx tsc --noEmit` before opening a PR. See [AGENTS.md](AGENTS.md) for an overview of the codebase and conventions (also handy if you work with AI coding agents).

## License

Licensed under the **GNU Affero General Public License v3.0** — see [LICENSE](LICENSE). If you run a modified version of Presensa as a network service, the AGPL requires you to make your modified source available to its users.
