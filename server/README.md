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

---

## Indoor Localization API

The server includes WiFi-based indoor positioning using trilateration. Raspberry Pi endpoints at known positions detect device MAC addresses and signal strength (RSSI), which the server uses to calculate device locations.

### Coordinate System

- **Units**: Meters (m)
- **Origin**: (0, 0) - Define this as a physical reference point in your space (e.g., northwest corner)
- **Axes**: 
  - X: Horizontal (typically east/west)
  - Y: Vertical (typically north/south)
  - Floor: Integer floor number (1 = ground floor, 2 = second floor, etc.)

### Setup: Configure Endpoint Positions

Before localization works, you must tell the server where each Raspberry Pi endpoint is physically located.

#### Set Endpoint Positions
**POST /api/endpoint/positions** (Protected by API key)

```bash
# Single endpoint
curl -X POST http://localhost:3000/api/endpoint/positions \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "EP001",
    "x": 0,
    "y": 0,
    "floor": 1,
    "description": "Northwest corner, Room 101"
  }'

# Multiple endpoints at once
curl -X POST http://localhost:3000/api/endpoint/positions \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "endpoint_id": "EP001",
      "x": 0,
      "y": 0,
      "floor": 1,
      "description": "Northwest corner"
    },
    {
      "endpoint_id": "EP002",
      "x": 15,
      "y": 0,
      "floor": 1,
      "description": "Northeast corner"
    },
    {
      "endpoint_id": "EP003",
      "x": 0,
      "y": 10,
      "floor": 1,
      "description": "Southwest corner"
    },
    {
      "endpoint_id": "EP004",
      "x": 15,
      "y": 10,
      "floor": 1,
      "description": "Southeast corner"
    }
  ]'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully stored 4 endpoint position(s)",
  "data": [...]
}
```

#### Get All Endpoint Positions
**GET /api/endpoint/positions** (Protected by API key)

```bash
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/api/endpoint/positions
```

#### Delete Endpoint Position
**DELETE /api/endpoint/positions?endpoint_id=EP001** (Protected by API key)

```bash
curl -X DELETE \
  -H "x-api-key: YOUR_API_KEY" \
  "http://localhost:3000/api/endpoint/positions?endpoint_id=EP001"
```

### Query Device Location

Client applications can query device locations by MAC address. Requires at least 3 endpoints detecting the device for accurate trilateration.

#### Get Single Device Location
**GET /api/query/device-location?mac=XX:XX:XX:XX:XX:XX**

```bash
# Basic query
curl "http://localhost:3000/api/query/device-location?mac=A1:B2:C3:D4:E5:F6"

# With optional filters
curl "http://localhost:3000/api/query/device-location?mac=A1:B2:C3:D4:E5:F6&max_age=30&min_rssi=-85"
```

**Query Parameters:**
- `mac` (required): Device MAC address
- `max_age` (optional): Maximum age of scans in seconds (default: 60)
- `min_rssi` (optional): Minimum signal strength to consider (default: -90 dBm)

**Response:**
```json
{
  "success": true,
  "data": {
    "mac": "A1:B2:C3:D4:E5:F6",
    "position": {
      "x": 7.5,
      "y": 5.2
    },
    "timestamp": "2025-10-26T...",
    "scans_used": 4,
    "accuracy_estimate": 3.2,
    "floor": 1
  },
  "debug": {
    "total_scans": 8,
    "endpoints_detected": 4,
    "scans": [
      {
        "endpoint_id": "EP001",
        "rssi": -45,
        "distance_meters": "3.16",
        "position": { "x": 0, "y": 0 }
      },
      ...
    ]
  }
}
```

**Response when no data available:**
```json
{
  "success": true,
  "message": "No recent scans found for this device",
  "data": {
    "mac": "A1:B2:C3:D4:E5:F6",
    "position": null,
    "scans_used": 0,
    "timestamp": "2025-10-26T..."
  }
}
```

#### Get Multiple Device Locations
**POST /api/query/device-location**

```bash
curl -X POST http://localhost:3000/api/query/device-location \
  -H "Content-Type: application/json" \
  -d '{
    "macs": [
      "A1:B2:C3:D4:E5:F6",
      "11:22:33:44:55:66",
      "AA:BB:CC:DD:EE:FF"
    ],
    "max_age": 60,
    "min_rssi": -90
  }'
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "mac": "A1:B2:C3:D4:E5:F6",
      "position": { "x": 7.5, "y": 5.2 },
      "timestamp": "2025-10-26T...",
      "scans_used": 4,
      "accuracy_estimate": 3.2,
      "floor": 1
    },
    ...
  ]
}
```

### Localization Algorithm

The server uses **trilateration** with these steps:

1. **RSSI to Distance Conversion**: Converts signal strength (dBm) to estimated distance using the log-distance path loss model:
   ```
   distance = 10^((TxPower - RSSI) / (10 * n))
   ```
   - TxPower: -59 dBm (typical WiFi at 1 meter)
   - n: 2.5 (path loss exponent for indoor environments)

2. **Trilateration**: Uses least squares method to solve for (x, y) position from 3+ endpoint distances. With more than 3 points, this provides better accuracy through overdetermined system solving.

3. **Fallback**: If linear system is singular, falls back to weighted centroid (inverse distance weighting).

4. **Filtering**: Only uses recent scans (default: last 60 seconds) with sufficient signal strength (default: > -90 dBm).

### Accuracy Considerations

- **Minimum 3 endpoints** required for 2D trilateration
- **4+ endpoints** recommended for better accuracy
- **Signal interference**: Walls, furniture, and people affect RSSI
- **Calibration**: For better accuracy, measure actual RSSI at known distances in your environment and adjust `txPower` and `pathLossExponent` in `/app/lib/localization.ts`
- **Update frequency**: More frequent scans = smoother tracking
- **Typical accuracy**: 2-5 meters in indoor environments

### Testing Localization

1. **Setup database and positions**:
```bash
# Create tables
curl -X POST http://localhost:3000/api/endpoint/setup-db \
  -H "x-api-key: YOUR_API_KEY"

# Configure 4 endpoints in a rectangle (15m x 10m)
curl -X POST http://localhost:3000/api/endpoint/positions \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"endpoint_id": "EP001", "x": 0, "y": 0, "floor": 1},
    {"endpoint_id": "EP002", "x": 15, "y": 0, "floor": 1},
    {"endpoint_id": "EP003", "x": 0, "y": 10, "floor": 1},
    {"endpoint_id": "EP004", "x": 15, "y": 10, "floor": 1}
  ]'
```

2. **Send test scan data** (simulate device at position 7.5, 5):
```bash
curl -X POST http://localhost:3000/api/endpoint/scan-data \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "endpoint_id": "EP001",
      "mac": "TEST:DE:VI:CE:00:01",
      "rssi": -45,
      "timestamp": "2025-10-26T12:00:00Z"
    },
    {
      "endpoint_id": "EP002",
      "mac": "TEST:DE:VI:CE:00:01",
      "rssi": -45,
      "timestamp": "2025-10-26T12:00:00Z"
    },
    {
      "endpoint_id": "EP003",
      "mac": "TEST:DE:VI:CE:00:01",
      "rssi": -45,
      "timestamp": "2025-10-26T12:00:00Z"
    },
    {
      "endpoint_id": "EP004",
      "mac": "TEST:DE:VI:CE:00:01",
      "rssi": -45,
      "timestamp": "2025-10-26T12:00:00Z"
    }
  ]'
```

3. **Query device location**:
```bash
curl "http://localhost:3000/api/query/device-location?mac=TEST:DE:VI:CE:00:01"
```

The device should be located near (7.5, 5) - the center of the 4 endpoints.

---

## Team Integration

### For Endpoint Team (Raspberry Pi)
1. Get API key from server team
2. Configure endpoint positions via `/api/endpoint/positions`
3. Send Wi-Fi scan data to `/api/endpoint/scan-data` 
4. Test with `/api/endpoint/test-db`

### For Client Team
1. Query device locations via `/api/query/device-location`
2. No API key needed (will use NextAuth in production)
3. Display positions on map/heatmap using returned (x, y) coordinates
4. Use `accuracy_estimate` and `scans_used` to show confidence

---


