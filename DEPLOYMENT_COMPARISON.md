# Fly.io Deployment Configuration Comparison

## Quick Reference: All Three Services

### Database (PostgreSQL)

**File:** `infra/fly-pg.toml`

```toml
app = 'seng401-project-zopac-postgres'
primary_region = 'iad'

[build]
dockerfile = "Dockerfile-pg"

[[services]]
  internal_port = 5432
  protocol = "tcp"
  
  [[services.ports]]
    port = 5432

[env]
  POSTGRES_DB = "appdb"
  POSTGRES_USER = "appuser"

[[vm]]
  size = 'shared-cpu-1x'

[mounts]
  source = "pgdata"
  destination = "/var/lib/postgresql"
```

**Key Points:**
- Uses TCP service (not HTTP)
- Has persistent volume mount for data
- Secrets set via CLI: `POSTGRES_PASSWORD`
- Accessible internally via: `seng401-project-zopac-postgres.internal:5432`

**Deploy Command:**
```bash
flyctl deploy --ha=false --config infra/fly-pg.toml --remote-only
```

---

### Server (Next.js)

**File:** `server/fly-server.toml`

```toml
app = 'seng401-project-zopac'
primary_region = 'iad'

[build]
  dockerfile = 'Dockerfile'

[env]
  NODE_ENV="production"
  POSTGRES_HOST="db"
  POSTGRES_PORT="5432"
  POSTGRES_DATABASE = 'appdb'
  POSTGRES_URL = 'postgres://appuser:devpass@seng401-project-zopac-postgres.internal:5432/appdb'
  POSTGRES_USER = 'appuser'
  CLIENT_URL = "https://seng401-project-zopac-client.fly.dev"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

[[vm]]
  size = 'shared-cpu-1x'
```

**Key Points:**
- Uses HTTP service
- Connects to database via internal DNS
- Serves API routes
- Auto-stop/start enabled

**Deploy Command:**
```bash
flyctl deploy --ha=false --config server/fly-server.toml --remote-only
```

**Public URL:** `https://seng401-project-zopac.fly.dev`

---

### Client (React/Vite)

**File:** `infra/fly-web.toml`

```toml
app = 'seng401-project-zopac-client'
primary_region = 'iad'

[build]
  dockerfile = "../client/Dockerfile"

[env]
  VITE_API_URL = "https://seng401-project-zopac.fly.dev"

[http_service]
  internal_port = 80
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

[[vm]]
  size = 'shared-cpu-1x'
```

**Key Points:**
- Uses HTTP service
- Serves on port 80 (nginx)
- Static files with SPA routing
- Connects to server via public URL

**Deploy Command:**
```bash
flyctl deploy --ha=false --config infra/fly-web.toml --remote-only
```

**Public URL:** `https://seng401-project-zopac-client.fly.dev`

---

## Configuration Pattern Analysis

### Common Elements (All Three)
```toml
primary_region = 'iad'          # All in Virginia datacenter

[[vm]]
  size = 'shared-cpu-1x'        # Same VM size for all

# Auto-scaling (Server & Client only)
auto_stop_machines = 'stop'
auto_start_machines = true
min_machines_running = 1
force_https = true
```

### Differences

| Aspect | Database | Server | Client |
|--------|----------|--------|--------|
| **App Name** | `*-postgres` | base name | `*-client` |
| **Service Type** | TCP | HTTP | HTTP |
| **Internal Port** | 5432 | 3000 | 80 |
| **Dockerfile Location** | `infra/` | `server/` | `client/` |
| **Config Location** | `infra/` | `server/` | `infra/` |
| **Persistent Storage** | ✅ Volume mount | ❌ None | ❌ None |
| **Public Access** | ❌ Internal only | ✅ Public URL | ✅ Public URL |
| **Auto-stop** | ❌ Always on | ✅ Yes | ✅ Yes |

### Environment Variables Pattern

**Database:**
- Minimal env vars (DB name, user)
- Password set as secret via CLI
- No external service dependencies

**Server:**
- Database connection strings
- Points to database internal DNS
- Points to client public URL (CORS)
- Node environment settings

**Client:**
- API URL pointing to server
- Vite-prefixed variables
- Embedded at build time

---

## GitHub Actions Workflows

### Database: `.github/workflows/deploy-pg.yml`
```yaml
name: Deploy Postgres
on:
  push:
    branches:
      - main
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --ha=false --config infra/fly-pg.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_PG }}
```

### Server: `.github/workflows/deploy-server.yml`
```yaml
name: Deploy Server
on:
  push:
    branches:
      - main
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --ha=false --config server/fly-server.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_SERVER }}
```

### Client: `.github/workflows/deploy-client.yml` *(newly created)*
```yaml
name: Deploy Client
on:
  push:
    branches:
      - main
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --ha=false --config infra/fly-web.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN_CLIENT }}
```

**Pattern:** Each workflow:
1. Triggers on push to `main`
2. Uses the same GitHub Actions
3. Uses service-specific config file
4. Uses service-specific API token
5. Uses `--remote-only` flag (builds on Fly.io servers)
6. Uses `--ha=false` flag (no high availability, saves cost)

---

## Deployment Order (First Time Setup)

1. **Database First**
   ```bash
   flyctl launch --config infra/fly-pg.toml
   flyctl volumes create pgdata -c infra/fly-pg.toml
   flyctl secrets set POSTGRES_PASSWORD=yourpass -c infra/fly-pg.toml
   flyctl deploy --ha=false --config infra/fly-pg.toml --remote-only
   ```

2. **Server Second** (needs database to be running)
   ```bash
   flyctl launch --config server/fly-server.toml
   flyctl deploy --ha=false --config server/fly-server.toml --remote-only
   ```

3. **Client Last** (needs server URL)
   ```bash
   flyctl launch --config infra/fly-web.toml
   flyctl deploy --ha=false --config infra/fly-web.toml --remote-only
   ```

---

## CLI Commands Used (Historical)

Based on the fly-example README and your deployment patterns:

```bash
# Initial setup
fly auth login

# Database
fly launch -c infra/fly-pg.toml
fly scale count 1 -c infra/fly-pg.toml
fly volumes create pgdata -c infra/fly-pg.toml
fly secrets set POSTGRES_PASSWORD=verysecret -c infra/fly-pg.toml

# Server
fly launch -c server/fly-server.toml
fly scale count 1 -c server/fly-server.toml
fly deploy --ha=false --config server/fly-server.toml --remote-only

# Client (new)
fly launch -c infra/fly-web.toml
fly scale count 1 -c infra/fly-web.toml
fly deploy --ha=false --config infra/fly-web.toml --remote-only

# Create GitHub tokens
# (Done via Fly.io dashboard → App → Settings → Tokens)
# Then add to GitHub: Repo Settings → Secrets → Actions
# - FLY_API_TOKEN_PG
# - FLY_API_TOKEN_SERVER
# - FLY_API_TOKEN_CLIENT
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Internet (HTTPS)                             │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
    ┌──────────────────┐        ┌──────────────────┐
    │     Client       │        │      Server      │
    │  (nginx:alpine)  │───────▶│    (Next.js)     │
    │                  │        │                  │
    │ Port: 80         │        │ Port: 3000       │
    │ React SPA        │        │ API Routes       │
    │ Static Assets    │        │ Auth Logic       │
    └──────────────────┘        └─────────┬────────┘
                                          │
    Public:                               │ Internal DNS
    seng401-project-zopac-client         │
    .fly.dev                              ▼
                                ┌──────────────────┐
    Public:                     │    Database      │
    seng401-project-zopac       │  (PostgreSQL)    │
    .fly.dev                    │                  │
                                │ Port: 5432       │
                                │ Persistent Volume│
                                └──────────────────┘
                                
                                Internal Only:
                                seng401-project-zopac-postgres
                                .internal:5432
```

---

## Summary

You now have a complete three-tier application deployed on Fly.io:

1. ✅ **Database:** Persistent PostgreSQL with volume storage
2. ✅ **Server:** Next.js API server with database connection
3. ✅ **Client:** React SPA served via nginx

All three follow the same deployment pattern:
- Dedicated configuration files
- Dockerized builds
- GitHub Actions automation
- Same region and VM size
- Auto-scaling enabled (where appropriate)

