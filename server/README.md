## Server (Next.js skeleton) — How to Run

This repository contains a **Next.js (App Router)** server skeleton under `server/`. It’s scaffolded from the official dashboard starter and includes a simple API route for verification.

### Prerequisites
- Node.js 20+ 
  ```bash
  nvm use 24.8.0  

### How to run
cd server
npm install next@latest react react-dom
npm run dev

App runs at: http://localhost:3000
Example API route: http://localhost:3000/api/hello

### Linter used
ESLint is being used as the Linter

### Database Setup (Sprint 2)
- Install [Docker Engine](https://docs.docker.com/engine/install/)
- Uses [Postgres Docker image](https://hub.docker.com/_/postgres)

#### Starting the Database
From the project root directory:
```bash
docker-compose up -d
```

#### Verify Database is Running
```bash
docker ps
```
You should see `app-postgres` container running on port 5432.

#### Database Connection Details
- **Host:** localhost
- **Port:** 5432
- **Database:** appdb
- **User:** appuser
- **Password:** devpass (for local development only)

#### Configure Environment Variables
Copy `.env.example` to `.env.local` and update with your database credentials:
```bash
cp .env.example .env.local
```

### API Key Setup (Sprint 3)

The server uses API key authentication to secure endpoint routes (for Raspberry Pi devices).

#### Generate an API Key
```bash
openssl rand -base64 32
```

Add the generated key to your `.env.local` file:
```bash
ENDPOINT_API_KEY="your-generated-key-here"
```

#### Testing the API

**Test Database Connectivity (Protected Route):**
```bash
# With valid API key
curl -H "x-api-key: YOUR_API_KEY_HERE" http://localhost:3000/api/endpoint/test-db

# Expected response:
# {
#   "ok": true,
#   "message": "Database connection successful",
#   "data": {
#     "current_time": "2025-10-20T...",
#     "db_version": "PostgreSQL 16..."
#   }
# }

# Without API key (should return 401)
curl http://localhost:3000/api/endpoint/test-db

# Expected response:
# {
#   "error": "Unauthorized - Invalid or missing API key"
# }
```

#### Quick Start for Team Members

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd server
   npm install
   ```

2. **Setup environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your ENDPOINT_API_KEY
   ```

3. **Start database:**
   ```bash
   cd ..
   docker-compose up -d
   ```

4. **Run server:**
   ```bash
   cd server
   npm run dev
   ```

5. **Test API:**
   ```bash
   curl -H "x-api-key: YOUR_KEY" http://localhost:3000/api/endpoint/test-db
   ```


### Client Team API Endpoints

These endpoints are for the React client (web UI) and do not require API keys.

#### Server IP Configuration
**POST /api/client/server-ip**
- Stores server IP configuration from client
- No authentication required (will use user session later)

```bash
curl -X POST http://localhost:3000/api/client/server-ip \
  -H "Content-Type: application/json" \
  -d '{"serverIP": "192.168.1.100"}'

# Response:
# {
#   "success": true,
#   "message": "Server IP received successfully",
#   "data": {
#     "serverIP": "192.168.1.100",
#     "receivedAt": "2025-10-20T..."
#   }
# }
```

**Client team:** Replace your Postman mock URL with:
```javascript
const response = await fetch('http://localhost:3000/api/client/server-ip', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ serverIP: ip }),
});
```


### Wi-Fi Scan Data Endpoint (Sprint 3 - User Story #23)

**Endpoint team:** This is where you send Wi-Fi scan data from Raspberry Pis.

#### Setup Database Schema
First-time setup - create the `wifi_scans` table:
```bash
curl -X POST http://localhost:3000/api/endpoint/setup-db \
  -H "x-api-key: YOUR_API_KEY"

# Response:
# {
#   "success": true,
#   "message": "Database schema created successfully",
#   "table": "wifi_scans"
# }
```

#### Send Scan Data
**POST /api/endpoint/scan-data**
- Receives Wi-Fi scan data from endpoints
- Requires API key authentication
- Supports single scan or batch scans

**Single Scan Example:**
```bash
curl -X POST http://localhost:3000/api/endpoint/scan-data \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "EP001",
    "mac": "A1:B2:C3:D4:E5:F6",
    "rssi": -45,
    "timestamp": "2025-10-21T12:00:00Z"
  }'

# Response:
# {
#   "success": true,
#   "message": "Successfully stored 1 scan(s)",
#   "data": [{
#     "id": 1,
#     "endpoint_id": "EP001",
#     "mac": "A1:B2:C3:D4:E5:F6",
#     "rssi": -45,
#     "timestamp": "2025-10-21T12:00:00.000Z",
#     "created_at": "2025-10-21T..."
#   }]
# }
```

**Batch Scans Example:**
```bash
curl -X POST http://localhost:3000/api/endpoint/scan-data \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "endpoint_id": "EP001",
      "mac": "A1:B2:C3:D4:E5:F6",
      "rssi": -45,
      "timestamp": "2025-10-21T12:00:00Z"
    },
    {
      "endpoint_id": "EP001",
      "mac": "11:22:33:44:55:66",
      "rssi": -67,
      "timestamp": "2025-10-21T12:00:01Z"
    }
  ]'
```

**Data Validation:**
- `endpoint_id`: Required string (e.g., "EP001", "RaspberryPi-A")
- `mac`: Required MAC address in format XX:XX:XX:XX:XX:XX
- `rssi`: Required integer between -100 and 0 (signal strength in dBm)
- `timestamp`: Required ISO 8601 timestamp or valid date string

**Error Response Example:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "Scan 0: invalid MAC address format (expected XX:XX:XX:XX:XX:XX)",
    "Scan 1: rssi must be an integer between -100 and 0"
  ]
}
```

#### Retrieve Scan Data (Testing/Debugging)
**GET /api/endpoint/scan-data**
```bash
# Get latest 100 scans
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/api/endpoint/scan-data

# Get scans from specific endpoint
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/api/endpoint/scan-data?endpoint_id=EP001"

# Limit results
curl -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/api/endpoint/scan-data?limit=10"
```

