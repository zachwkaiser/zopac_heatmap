# Security Update: Rotating Exposed Secrets

## What Happened
API keys and authentication secrets were accidentally committed to the repository in `docker-compose.yml` with default values.

## What Was Changed
1. **Removed hardcoded secrets** from `docker-compose.yml`
2. **Generated new secrets** to replace the exposed ones
3. **Created `.env.example`** template for team members
4. **Updated `server/.env.local`** with new secrets

## Old Secrets - NOW INVALID
The previously exposed secrets have been rotated and are no longer valid.

## New Setup Required

### For Local Development:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Contact the server team lead to get the current secrets and add them to `.env`

3. Start Docker:
   ```bash
   docker-compose up -d
   ```

### For Endpoint Team (Raspberry Pi):
See `endpoint/API_KEY_UPDATE.md` for instructions on updating your configuration.

## Files Changed
- `docker-compose.yml` - Removed hardcoded secrets
- `server/.env.local` - Updated with new secrets (not in git)
- `.env` - Created with new secrets (NOT committed, .gitignored)
- `.env.example` - Template for team members
