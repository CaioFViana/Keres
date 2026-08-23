<div align="center">
  <img src="apps/client/assets/images/icon_keres.png" alt="Keres" width="112" />
  <h1>Keres</h1>
  <p><strong>Organize universes, connect narratives, and write anywhere.</strong></p>
  <p>An offline-first story planning platform for mobile, web, and desktop, with optional synchronization across devices.</p>
  <p><a href="https://caiofviana.github.io/Keres/">Landing page</a></p>
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
| `apps/site` | React, Vite | Public landing page published on GitHub Pages |
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

- API and Swagger: `http://localhost:3000/api/swagger`
- Health check: `http://localhost:3000/api/kerescheck`
- Built administration panel: `http://localhost:3000/admin`
- Hosted web client (same origin, COOP/COEP): `http://localhost:3000/` — requires `bun run --cwd apps/client export:web`
- Published-story showcase: `http://localhost:3000/showcase`
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

## Keres Server (no Docker)

To sync a home PC with a phone **without** PostgreSQL or Compose, the API can also run on SQLite. **Keres Server** is that API plus a command-line setup wizard (Portuguese/English). It does not replace the Docker image: production Postgres still ships via GHCR.

### Download (users)

Each `v*.*.*` tag attaches the zips to the matching [GitHub Release](https://github.com/caiofviana/keres/releases), alongside the desktop client, Android builds, and the Docker image. Pick the file for your system:

| System | File |
| --- | --- |
| Windows x64 | `Keres-Server-windows-x64-<version>.zip` |
| Linux x64 | `Keres-Server-linux-x64-<version>.zip` |
| macOS Apple Silicon | `Keres-Server-macos-arm64-<version>.zip` |

Unzip and run `keres-server` / `keres-server.exe`. Bun, Node, and Docker are not required. The zip holds the executable, the libSQL native addon, migrations, the `/admin` panel, and a `README.md` (setup and backups). Bun's compiler cannot embed libSQL's `.node`, so this is not a single file.

On first run the wizard asks for the database (SQLite by default), local vs S3 media, the port, and whether to listen on this computer only or on the LAN. Data lives **outside** the zip folder (replacing the executable does not wipe the database):

| System | Folder |
| --- | --- |
| Windows | `%APPDATA%\KeresServer` |
| macOS | `~/Library/Application Support/KeresServer` |
| Linux | `~/.local/share/keres-server` |

While running, the CLI prints this machine's current LAN IPv4 addresses (`http://192.168.x.x:<port>`) and reprints them if the router assigns a new one. There is no local DNS.

### Backups (this should be done)

The zip includes a `README.md` (Portuguese and English) next to the executable. **Back up at least once a month:** stop the server (`Ctrl+C`), run `keres-server --backup` from the program folder, then start it again. Each copy lands in a folder named with the date and time (`KeresServer-backups\…`). Keep that folder on another disk.

If the worst happens: stop the server, empty the data folder, and copy the dated folder’s contents into it. The zip README lists the files. PostgreSQL or S3 outside this machine stays the operator’s backup.

### Development

```bash
bun run start:launcher
bun run package:server
```

`package:server` builds the same folder and zip the release job publishes. `start:api` and Compose **do not** go through the wizard: they still read `.env`.

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
curl --fail http://127.0.0.1:3000/api/kerescheck
```

On its first startup, the API waits for PostgreSQL to become healthy, applies migrations, and only then begins serving traffic.

### 3. Publish with HTTPS

Place Caddy, Nginx, Traefik, or your platform proxy in front of `127.0.0.1:3000` and terminate TLS there. Forward the complete host, preserve paths, and enable WebSocket upgrades for `/api/ws`. Do not publish PostgreSQL port 5432.

Configure the public HTTPS URL in the client without suffixes such as `/api`, `/swagger` or `/admin` — for example, `https://keres.example.com`.

### Updates, rollback, and backups

```bash
# Update to the tag configured in .env
docker compose pull api
docker compose up -d api

# Follow startup and migrations
docker compose logs -f api
```

To roll back, change `KERES_IMAGE_TAG` to a compatible earlier version and repeat the commands. Backups for this Compose deploy belong to whoever operates the host (the API accepts any Postgres you point it at; it will not run `pg_dump` itself). Before every update, copy both PostgreSQL **and** the media volume; synchronized stories and uploads are separate datasets. A logical dump:

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
- `Keres-Server-windows-x64-<version>.zip`, `Keres-Server-linux-x64-<version>.zip`, and `Keres-Server-macos-arm64-<version>.zip` (home API, no Docker);
- a Windows installer and portable executable;
- a macOS DMG;
- Linux AppImage and Flatpak packages;
- signed Android APK and AAB packages.

## Landing (GitHub Pages)

The public project page lives in `apps/site` and is published at [caiofviana.github.io/Keres](https://caiofviana.github.io/Keres/). It is not a server's story showcase (that is the Showcase, served by the API): it is the product landing page, in Portuguese and English.

```bash
bun run dev:site      # http://localhost:5175
bun run build:site
```

The `.github/workflows/pages.yml` workflow builds and publishes on every push to `master` (the default branch). The `github-pages` environment rejects other branches. The first time, under Settings → Pages, set the source to **GitHub Actions**.

## Technical documentation

The documents below are currently maintained in Portuguese:

- [Actual monorepo structure](docs/file_structure.md)
- [Project plan and architecture](docs/project_plan.md)
- [Screen flow](docs/screen_flow.md)
- [Choice mechanics](docs/choice_mechanics.md)
- [Stat system and radar chart](docs/stat_system.md)
- [Sync and conflict resolution](docs/conflict_resolution_client_strategy.md)

## Operational security

- Never reuse development secrets in production.
- Keep the API behind HTTPS; tokens and credentials must not travel over public HTTP.
- Restrict access to `/admin` at the proxy when the panel does not need to be public.
- Back up `db_data` and `media_storage`; removing volumes destroys persistent data. For Keres Server, follow the zip's `README.md` (monthly copy of the data folder, server stopped).
- Pin an image tag in production and validate migrations and logs before discarding backups.
