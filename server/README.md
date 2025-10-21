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

