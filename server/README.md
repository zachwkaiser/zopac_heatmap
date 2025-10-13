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
