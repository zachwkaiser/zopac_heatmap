import { NextResponse } from 'next/server';
import postgres from 'postgres';


const lastSeenMap = new Map<string, Date>();


/*
INSERT INTO endpoint_health (
    endpoint_id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(50) NOT N
    last_seen TIMESTAMP NOT NULL,
    last_scan_time TIMESTAMP,
    total_scans INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/

// Function to get DB connection (to be implemented)
async function getDb() {
    // return postgres({
    //     host: process.env.POSTGRES_HOST,
    //     port: Number(process.env.POSTGRES_PORT) || 5432,
    //     database: process.env.POSTGRES_DATABASE,
    //     username: process.env.POSTGRES_USER,
    //     password: process.env.POSTGRES_PASSWORD,
    //     ssl: false
    // });
    return null;
}

// POST /api/endpoint/status
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const endpoint_id = body.endpoint_id;

    if (!endpoint_id) {
      return NextResponse.json({ error: 'endpoint_id is required' }, { status: 400 });
    }

    
    /*
    const sql = await getDb();
    await sql`
        INSERT INTO endpoint_health (endpoint_id, status, last_seen, total_scans)
        VALUES (${endpoint_id}, 'online', CURRENT_TIMESTAMP, 1)
        ON CONFLICT (endpoint_id) DO UPDATE
        SET status = 'online',
            last_seen = CURRENT_TIMESTAMP,
            last_scan_time = CURRENT_TIMESTAMP,
            total_scans = endpoint_health.total_scans + 1,
            updated_at = CURRENT_TIMESTAMP;
    `;
    */

   
    lastSeenMap.set(endpoint_id, new Date());

    return NextResponse.json({
        success: true,
        message: `Endpoint ${endpoint_id} status updated`
    });

  } catch (error) {
    console.error('Error updating endpoint status:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}


// GET /api/endpoint/status
export async function GET() {
    try {
        /*
        const sql = await getDb();
        const endpoints = await sql`
            SELECT 
                endpoint_id,
                status,
                last_seen,
                last_scan_time,
                total_scans,
                CASE 
                    WHEN last_seen > NOW() - INTERVAL '2 minutes' THEN 'online'
                    ELSE 'offline'
                END as current_status
            FROM endpoint_health
            ORDER BY last_seen DESC;
        `;
        return NextResponse.json({ endpoints });
        */

        
          const endpoints = Array.from(lastSeenMap.entries()).map(([id, lastSeen]) => {
            const isAlive = (new Date().getTime() - lastSeen.getTime()) < 120000;
            if (!isAlive) {
                console.log(`this endpoint is dead: ${id}`);
            }
            return {
                endpoint_id: id,
                status: isAlive ? 'online' : 'offline',
                last_seen: lastSeen.toISOString(),
                message: isAlive ? undefined : 'this endpoint is dead'
            };
        });
      

        return NextResponse.json({ endpoints });
    } catch (error) {
        console.error('Error fetching endpoints:', error);
        return NextResponse.json({ error: 'Failed to get endpoints' }, { status: 500 });
    }
    
}