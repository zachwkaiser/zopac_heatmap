# Raspberry Pi Endpoint Deployment Fix

## Issues Identified

From the Pi logs, two server-side issues were found:

1. **Schema mismatch**: `column "created_at" does not exist` in wifi_scans table
2. **Body size limit**: Large batches (109k records) exceed default 10MB JSON limit

## Quick Fix Steps

### 1. Deploy Updated Server

```bash
cd /Users/prestonbeachum/seng-401/seng401-project-zopac/server

# Deploy to Fly.io
fly deploy
```

### 2. Run Database Migration

After deployment completes, run the migration endpoint once:

```bash
# Run migration to add missing columns
curl -X POST https://seng401-project-zopac.fly.dev/api/endpoint/migrate-db
```

Expected response:
```json
{
  "success": true,
  "message": "Database migration completed",
  "migrations": [
    "Added created_at column to wifi_scans",
    "Added z column to endpoint_positions"
  ]
}
```

### 3. Restart Pi Capture Service

On the Raspberry Pi:

```bash
# Restart the capture service
sudo systemctl restart wifi-capture.service

# Watch logs for successful POSTs
journalctl -u wifi-capture.service -n 100 -f
```

You should now see:
```
INFO [stream]: Posting batch with N records to ...
INFO [stream]: POST /scan-data -> 201
```

Instead of the previous errors:
- ❌ `column "created_at" does not exist`
- ❌ `Unterminated string in JSON at position 10485760`

## Changes Made

### 1. next.config.ts
- Added 50MB body size limit for large scan data batches

### 2. setup-db/route.ts
- Added `z FLOAT DEFAULT 0` to endpoint_positions table for 3D localization

### 3. migrate-db/route.ts (NEW)
- Created migration endpoint to add missing columns to existing tables
- Checks for column existence before adding (idempotent)

## Verification

After migration, verify the schema:

```bash
# Connect to cloud Postgres
fly postgres connect -a seng401-project-zopac-postgres

# In psql:
\d wifi_scans
\d endpoint_positions
```

Expected wifi_scans columns:
- id, endpoint_id, mac, rssi, timestamp, **created_at** ✅

Expected endpoint_positions columns:
- endpoint_id, x, y, **z** ✅, floor, description, created_at, updated_at

## Troubleshooting

If you still see errors after migration:

```bash
# Check server logs
fly logs -a seng401-project-zopac

# Check Pi logs with filters
journalctl -u wifi-capture.service --since "5 min ago" | grep -E "POST|ERROR|201|500"
```

Expected successful flow:
1. Pi captures WiFi data → tcpdump
2. stream.py parses and batches → POST to /api/endpoint/scan-data
3. Server validates and inserts → 201 Created
4. Heartbeat continues → POST to /api/endpoint/status → 200 OK
