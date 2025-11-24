# Client Deployment Guide for Fly.io

## Overview
This guide documents how to deploy the React/Vite client to Fly.io, following the same pattern used for the server and database deployments.

## Configuration Files Created

### 1. `infra/fly-web.toml`
The Fly.io configuration file for the client application.

**Key settings:**
- **App name:** `seng401-project-zopac-client`
- **Region:** `iad` (Virginia) - same as server and database
- **Dockerfile:** Points to `../client/Dockerfile`
- **Internal port:** 80 (nginx serves on port 80)
- **VM size:** `shared-cpu-1x`
- **Environment variables:**
  - `VITE_API_URL`: URL of your deployed server

### 2. `.github/workflows/deploy-client.yml`
GitHub Actions workflow for automated deployment on push to main branch.

## Deployment Steps

### Initial Setup (First Time Only)

#### Step 1: Install Fly CLI
If you haven't already:
```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

#### Step 2: Login to Fly.io
```bash
flyctl auth login
```

#### Step 3: Launch the Client App
From the project root directory:
```bash
flyctl launch --config infra/fly-web.toml --no-deploy
```

This will:
- Create the app on Fly.io
- Register the app name `seng401-project-zopac-client`
- Generate necessary infrastructure

**Important:** When prompted:
- Choose region: `iad` (Virginia) - to match your server and database
- Don't deploy yet (we need to set up environment variables first)

#### Step 4: Set Environment Variables
Update the `VITE_API_URL` in `infra/fly-web.toml` with your actual server URL:
```toml
[env]
  VITE_API_URL = "https://seng401-project-zopac.fly.dev"
```

You can also set secrets if needed:
```bash
flyctl secrets set SOME_SECRET_KEY=value --config infra/fly-web.toml
```

#### Step 5: Update Server's CLIENT_URL
Update the server configuration to allow CORS from the client:
```bash
# Edit server/fly-server.toml
# Change CLIENT_URL from "http://localhost:80" to:
CLIENT_URL = "https://seng401-project-zopac-client.fly.dev"
```

Then redeploy the server:
```bash
flyctl deploy --ha=false --config server/fly-server.toml --remote-only
```

#### Step 6: Scale Down Machines (Optional but Recommended)
Fly.io likes to create 2 machines by default. For cost savings:
```bash
flyctl scale count 1 --config infra/fly-web.toml
```

#### Step 7: Deploy the Client
```bash
flyctl deploy --ha=false --config infra/fly-web.toml --remote-only
```

The `--remote-only` flag builds the Docker image on Fly.io's servers instead of locally.

### Step 8: Set Up GitHub Actions (Automated Deployment)

#### Create a Fly.io API Token
1. Go to your Fly.io dashboard
2. Navigate to the client app (`seng401-project-zopac-client`)
3. Go to Settings > Tokens
4. Click "Create token"
5. Give it a descriptive name like "GitHub Actions - Client"
6. Copy the token

#### Add Token to GitHub Secrets
1. Go to your GitHub repository
2. Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Name: `FLY_API_TOKEN_CLIENT`
5. Value: Paste the token you copied
6. Click "Add secret"

Now, every push to the `main` branch will automatically deploy your client!

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Fly.io Infrastructure                 │
│                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────┐ │
│  │   Client       │  │    Server      │  │  Database  │ │
│  │   (nginx)      │→ │   (Next.js)    │→ │ (Postgres) │ │
│  │   Port: 80     │  │   Port: 3000   │  │ Port: 5432 │ │
│  │                │  │                │  │            │ │
│  │  React/Vite    │  │   API Routes   │  │   Data     │ │
│  │  SPA           │  │   Auth         │  │  Storage   │ │
│  └────────────────┘  └────────────────┘  └────────────┘ │
│                                                           │
│  seng401-project    seng401-project   seng401-project   │
│  -zopac-client.     -zopac.           -zopac-postgres.  │
│  fly.dev            fly.dev           internal          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Configuration Pattern Comparison

| Component | Config File | Dockerfile | Internal Port | Service Type |
|-----------|------------|------------|---------------|--------------|
| **Database** | `infra/fly-pg.toml` | `infra/Dockerfile-pg` | 5432 | TCP |
| **Server** | `server/fly-server.toml` | `server/Dockerfile` | 3000 | HTTP |
| **Client** | `infra/fly-web.toml` | `client/Dockerfile` | 80 | HTTP |

All three:
- Use region: `iad`
- Use VM: `shared-cpu-1x`
- Have GitHub Actions workflows
- Auto-start/stop machines enabled

## Client Dockerfile Details

The client uses a **multi-stage build**:

1. **Builder stage** (node:20-alpine):
   - Installs dependencies with `npm ci`
   - Builds the Vite app with `npm run build`
   - Outputs to `/app/dist`

2. **Production stage** (nginx:alpine):
   - Uses nginx as the web server
   - Copies built assets from builder stage
   - Uses custom nginx.conf for SPA routing
   - Serves on port 80

This approach:
- ✅ Minimal production image size
- ✅ Fast static file serving with nginx
- ✅ Proper SPA routing (all routes → index.html)
- ✅ Asset caching enabled

## API URL Configuration

**✅ RESOLVED:** The client now uses environment variables for API URLs.

All API calls in the client have been updated to use `import.meta.env.VITE_API_URL`:

**Files updated:**
- `client/src/components/heatmap/index.tsx` (4 fetch calls)
- `client/src/components/homepage/index.tsx` (2 fetch calls)
- `client/src/components/heatmap/getData.ts` (1 axios call)
- `client/src/global.d.ts` (TypeScript type definitions)

**Implementation:**
```typescript
// Each file now includes:
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
await fetch(`${API_URL}/api/query/heatmap-data`);
```

This allows the client to work in both development (localhost) and production (Fly.io) environments.

## Useful Commands

```bash
# View logs
flyctl logs --config infra/fly-web.toml

# Check app status
flyctl status --config infra/fly-web.toml

# SSH into the running machine
flyctl ssh console --config infra/fly-web.toml

# View app details
flyctl info --config infra/fly-web.toml

# List all machines
flyctl machines list --config infra/fly-web.toml

# Scale machines
flyctl scale count 1 --config infra/fly-web.toml

# Update environment variables
flyctl secrets set KEY=VALUE --config infra/fly-web.toml

# Restart the app
flyctl apps restart seng401-project-zopac-client
```

## Troubleshooting

### Build Fails
```bash
# Check build logs
flyctl logs --config infra/fly-web.toml

# Try building locally first
cd client
npm run build
```

### App Won't Start
```bash
# Check if nginx is configured correctly
flyctl ssh console --config infra/fly-web.toml
# Then inside the container:
nginx -t
cat /etc/nginx/conf.d/default.conf
```

### CORS Errors
- Ensure server's `CLIENT_URL` environment variable includes the client's Fly.io URL
- Check server's CORS configuration

### Environment Variables Not Working
- Vite environment variables must start with `VITE_`
- They're embedded at **build time**, not runtime
- Rebuild after changing them

## Next Steps

1. ✅ Created `infra/fly-web.toml` configuration
2. ✅ Created `.github/workflows/deploy-client.yml` workflow
3. ✅ Updated client code to use environment variables (all 7 API calls updated)
4. ✅ Updated server's `CLIENT_URL` in `server/fly-server.toml`
5. ⚠️  **TODO:** Run the deployment commands above (see "Deployment Steps" section)

## Cost Considerations

- **Shared CPU 1x VM:** ~$2-3/month when running
- **Auto-stop enabled:** Stops when idle, saves money
- **Auto-start enabled:** Wakes up on first request
- **Disk:** Minimal (only container image), included
- **Bandwidth:** 160 GB/month included in free tier

Total estimated cost for all three services: ~$6-9/month

