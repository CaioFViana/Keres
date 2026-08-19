<div align="center">
  <img src="apps/client/assets/images/icon_keres.png" alt="Keres" width="112" />
  <h1>Keres</h1>
  <p><strong>Organize universes, connect narratives, and write anywhere.</strong></p>
  <p>An offline-first story planning platform for mobile, web, and desktop, with optional synchronization across devices.</p>
  <p><a href="README.md">Português</a> · <strong>English</strong></p>

  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-1.2.19-14151A?logo=bun" alt="Bun 1.2.19" /></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-54-000020?logo=expo" alt="Expo 54" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&amp;logoColor=white" alt="PostgreSQL 16" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&amp;logoColor=white" alt="Docker ready" /></a>
</div>

## Overview

Keres brings characters, locations, chapters, scenes, choices, items, world rules, notes, media, and relationships together in one workspace. The client stores each story in a local SQLite database and continues to work without a connection. When a server is configured, the synchronization engine replicates changes to the API and handles version conflicts.

| Component | Technology | Responsibility |
| --- | --- | --- |
| `apps/client` | React Native, Expo, SQLite | Main application for Android, iOS, and web |
| `apps/desktop` | Electron | Desktop distribution of the same web client |
| `apps/api` | Bun, Elysia, Drizzle, PostgreSQL | Authentication, synchronization, collaboration, and media |
| `apps/admin` | React, Vite | Administration panel served by the API at `/admin` |
| `packages/shared` | TypeScript, Zod | Shared entities, contracts, and metadata |

```mermaid
flowchart LR
    C["Keres client<br/>mobile · web · desktop"]
    L[("Local SQLite<br/>offline-first")]
    A["Keres API<br/>Bun + Elysia"]
    P[("PostgreSQL")]
    M[("Media files")]
    D["Admin panel<br/>/admin"]

    C <--> L
    C <-- "HTTPS + WebSocket" --> A
    A <--> P
    A <--> M
    A --> D
```

## In-app help

The **Help** drawer is available from both the main menu and a story menu. It contains Portuguese and English pages for Keres features, with local search, interface paths, and explanations of visible fields. The `?` icons in headers open the help page for the current screen.

## Quick start

### Requirements

- [Bun 1.2.19](https://bun.sh/) — the version used by the release pipeline and to generate the lockfile.
- [Node.js 20 or newer](https://nodejs.org/) — used by supporting Expo client scripts.
- [Docker with Compose](https://docs.docker.com/compose/) — required for local PostgreSQL and container workflows.
- For native development: Android Studio/JDK 17 for Android; macOS/Xcode for iOS.

Install the entire monorepo from its root:

```bash
bun install --frozen-lockfile
```

### Local development

1. Configure `apps/api/.env` with values used exclusively by your local environment:

   ```dotenv
   DATABASE_URL=postgresql://user:password@localhost:5432/keres_db
   JWT_SECRET=replace-with-a-secret-containing-at-least-32-characters
   JWT_SECRET_REFRESH=replace-with-another-secret-containing-at-least-32-characters
   ROOT_ADMIN_USERNAME=root
   ROOT_ADMIN_PASSWORD=replace-with-a-password-containing-8-or-more-characters
   ```

   `ROOT_ADMIN_*` is optional. When defined, the user is created or reconciled as an administrator on every startup; the configured password is also reapplied.

2. Start PostgreSQL only:

   ```bash
   docker compose -f apps/api/docker-compose.yml up -d db
   ```

3. In one terminal, build the admin panel and start the API:

   ```bash
   bun run build:admin
   bun run start:api
   ```

   PostgreSQL migrations are applied automatically before the API accepts connections.

4. In another terminal, start the client:

   ```bash
   cd apps/client
   bun run start
   ```

After startup, choose a target in the Expo terminal. In Keres, register the appropriate server URL for your device:

| Target | Local API URL |
| --- | --- |
| Browser or iOS Simulator | `http://localhost:3000` |
| Standard Android Emulator | `http://10.0.2.2:3000` |
| Physical device | `http://YOUR-MACHINE-IP:3000` |

For a physical device, the computer and device must be on the same network, and port 3000 must be allowed through the local firewall.

Available services:

- API and Swagger: `http://localhost:3000/swagger`
- Health check: `http://localhost:3000/kerescheck`
- Built administration panel: `http://localhost:3000/admin`
- Administration panel with hot reload: run `bun run dev` in `apps/admin` and open `http://localhost:5173/admin/`

### Local Docker stack

To build an image from the current checkout and start the API and PostgreSQL:

```bash
bun run docker:up
docker compose -f apps/api/docker-compose.yml logs -f api
```

The environment is available at `http://localhost:3000`. The database and media use named volumes and survive container recreation. To stop the stack without deleting its data:

```bash
bun run docker:down
```

Do not add `--volumes` to the shutdown command if you intend to preserve the database and uploads.

## Other development workflows

```bash
# Web client
cd apps/client && bun run web

# Static web export
cd apps/client && bun run export:web

# Electron in local mode
bun run desktop:start

# Package Electron for the current system
bun run desktop:package

# Client checks
cd apps/client && bun run lint
cd apps/client && bun run locales:audit
```

See the [client-specific guide](apps/client/README.en.md) for native builds, the local database, and Expo troubleshooting.

## API deployment

Versioned releases publish the API and administration panel to GitHub Container Registry:

```bash
docker pull ghcr.io/caiofviana/keres:latest
```

For production, prefer an immutable tag such as `1.2.3` over `latest`. The `apps/api/docker-compose.deploy.yml` file uses the published image, keeps PostgreSQL and media in persistent volumes, and exposes the API only on `127.0.0.1:3000` by default.

### 1. Prepare the server

Install Docker Engine with the Compose plugin. Copy `apps/api/docker-compose.deploy.yml` to a dedicated service directory and create a `.env` file alongside it:

```dotenv
KERES_IMAGE_TAG=latest
KERES_BIND_ADDRESS=127.0.0.1
KERES_PORT=3000
SERVER_VERSION=1.0.0

POSTGRES_DB=keres
POSTGRES_USER=keres
POSTGRES_PASSWORD=generate-a-long-random-password-without-url-characters

JWT_SECRET=generate-a-random-secret-containing-at-least-32-characters
JWT_SECRET_REFRESH=generate-another-independent-secret-containing-at-least-32-characters
ROOT_ADMIN_USERNAME=root
ROOT_ADMIN_PASSWORD=generate-a-strong-administrator-password
MEDIA_MAX_BYTES=52428800
```

Use independent random values and keep this file out of version control. You can generate suitable secrets with `openssl rand -hex 32`. Because the PostgreSQL password becomes part of a URL, use a long alphanumeric password or correctly encode reserved characters.

If the GHCR package is private, authenticate the host with a Personal Access Token carrying the `read:packages` permission:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Public packages do not require authentication.

### 2. Start and validate

From the directory containing the Compose file and `.env`:

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f api
```

Validate the deployment locally on the server:

```bash
curl --fail http://127.0.0.1:3000/kerescheck
```

On its first startup, the API waits for PostgreSQL to become healthy, applies migrations, and only then begins serving traffic.

### 3. Publish with HTTPS

Place Caddy, Nginx, Traefik, or your platform proxy in front of `127.0.0.1:3000` and terminate TLS there. Forward the complete host, preserve paths, and enable WebSocket upgrades for `/ws`. Do not publish PostgreSQL port 5432.

Configure the public HTTPS URL in the client without suffixes such as `/swagger` or `/admin` — for example, `https://keres.example.com`.

### Updates, rollback, and backups

```bash
# Update to the tag configured in .env
docker compose pull api
docker compose up -d api

# Follow startup and migrations
docker compose logs -f api
```

To roll back, change `KERES_IMAGE_TAG` to a compatible earlier version and repeat the commands. Before every update, back up both PostgreSQL and the media volume; synchronized stories and uploads are separate datasets. Create a logical database dump with:

```bash
docker compose exec -T db pg_dump -U keres -d keres -Fc > keres.dump
```

Adjust the user and database if you changed their defaults. Keep a consistent copy of the `media_storage` volume as well, and periodically test the restoration process.

## Releases

The `.github/workflows/release.yml` workflow runs only for semantic tags matching `v*.*.*`:

```bash
git tag v1.2.3
git push origin v1.2.3
```

A release publishes:

- Docker images `ghcr.io/caiofviana/keres:1.2.3` and `:latest`;
- a Windows installer and portable executable;
- a macOS DMG;
- Linux AppImage and Flatpak packages;
- signed Android APK and AAB packages;
- a GitHub Release containing the generated artifacts.

## Technical documentation

The documents below are currently maintained in Portuguese:

- [Actual monorepo structure](docs/file_structure.md)
- [Project plan and architecture](docs/project_plan.md)
- [Screen flow](docs/screen_flow.md)
- [Choice mechanics](docs/choice_mechanics.md)
- [Sync and conflict resolution](docs/conflict_resolution_client_strategy.md)

## Operational security

- Never reuse development secrets in production.
- Keep the API behind HTTPS; tokens and credentials must not travel over public HTTP.
- Restrict access to `/admin` at the proxy when the panel does not need to be public.
- Back up `db_data` and `media_storage`; removing volumes destroys persistent data.
- Pin an image tag in production and validate migrations and logs before discarding backups.
