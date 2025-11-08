import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// Rate limiting map: endpoint_id -> last update timestamp
const updateRateLimit = new Map<string, Date>();
const RATE_LIMIT_MS = 5000; // 5 seconds between updates

const lastSeenMap = new Map<string, Date>();

async function getDb() {
    return postgres({
        host: process.env.POSTGRES_HOST,
        port: 5432,
        database: process.env.POSTGRES_DATABASE,
        username: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        ssl: false,
    });
}

/**
 * POST /api/endpoint_health/status
 * 
 * Endpoint for updating the health status of a monitoring endpoint
 * 
 * @param request.body.endpoint_id - Unique identifier for the endpoint
 * @param request.body.scan_count - Number of scans performed (optional, defaults to 1)
 * 
 * @returns {Object} Response containing endpoint status details
 * @throws {400} If endpoint_id is missing or scan_count is invalid
 * @throws {429} If rate limit is exceeded
 */
export async function POST(request: NextRequest) {
    try {
        const sql = await getDb();
        const body = await request.json();
        const { endpoint_id, scan_count = 1 } = body;

        if (!endpoint_id) {
            await sql.end();
            return NextResponse.json({ error: 'endpoint_id is required' }, { status: 400 });
        }

        // Validate scan_count
        if (typeof scan_count !== 'number' || scan_count < 0 || !Number.isInteger(scan_count)) {
            await sql.end();
            return NextResponse.json({ error: 'scan_count must be a non-negative integer' }, { status: 400 });
        }

        // Rate limiting check
        const lastUpdate = updateRateLimit.get(endpoint_id);
        const now = new Date();
        if (lastUpdate && (now.getTime() - lastUpdate.getTime()) < RATE_LIMIT_MS) {
            await sql.end();
            return NextResponse.json({ 
                error: 'Rate limit exceeded',
                retryAfter: RATE_LIMIT_MS - (now.getTime() - lastUpdate.getTime())
            }, { status: 429 });
        }
        updateRateLimit.set(endpoint_id, now);

        
        await sql`
            CREATE TABLE IF NOT EXISTS endpoint_health (
                endpoint_id VARCHAR(255) PRIMARY KEY,
                status VARCHAR(50) NOT NULL DEFAULT 'online',
                last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_scan_time TIMESTAMP,
                total_scans INTEGER DEFAULT 0,
                uptime_seconds INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        // Update endpoint health status
        const result = await sql`
            INSERT INTO endpoint_health (endpoint_id, status, last_seen, last_scan_time, total_scans)
            VALUES (${endpoint_id}, 'online', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${scan_count})
            ON CONFLICT (endpoint_id) DO UPDATE
            SET status = 
                CASE 
                    WHEN endpoint_health.last_seen < NOW() - INTERVAL '2 minutes'
                    THEN 'reconnected'
                    ELSE 'online'
                END,
                last_seen = CURRENT_TIMESTAMP,
                last_scan_time = CURRENT_TIMESTAMP,
                total_scans = endpoint_health.total_scans + ${scan_count},
                uptime_seconds = 
                    CASE 
                        WHEN endpoint_health.last_seen > NOW() - INTERVAL '2 minutes'
                        THEN endpoint_health.uptime_seconds + 
                             EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - endpoint_health.last_seen))::INTEGER
                        ELSE 0
                    END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        await sql.end();

        
        lastSeenMap.set(endpoint_id, new Date());

        return NextResponse.json({
            success: true,
            message: `Endpoint ${endpoint_id} status updated`,
            endpoint: {
                endpoint_id: result[0].endpoint_id,
                status: result[0].status,
                last_seen: result[0].last_seen,
                total_scans: result[0].total_scans,
                uptime_seconds: result[0].uptime_seconds
            }
        });

  } catch (error) {
    console.error('Error updating endpoint status:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}


/**
 * GET /api/endpoint_health/status
 * 
 * Retrieve the health status of endpoints
 * 
 * @param request.searchParams.endpoint_id - Optional: Get status for a specific endpoint
 * 
 * @returns {Object} Response containing:
 *   - success: boolean
 *   - count: number of endpoints
 *   - endpoints: array of endpoint status objects or single endpoint object
 * @throws {404} If specific endpoint_id is not found
 * @throws {500} If database query fails
 */
export async function GET(request: NextRequest) {
    try {
        const sql = await getDb();
        const { searchParams } = new URL(request.url);
        const endpoint_id = searchParams.get('endpoint_id');

        
        const tableExists = await sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'endpoint_health'
            );
        `;

        if (!tableExists[0].exists) {
            await sql.end();
            return NextResponse.json({
                success: true,
                count: 0,
                endpoints: []
            });
        }

        let result;
        if (endpoint_id) {
            // Get specific endpoint
            result = await sql`
                SELECT 
                    endpoint_id,
                    CASE 
                        WHEN last_seen > NOW() - INTERVAL '2 minutes' THEN status
                        ELSE 'offline'
                    END as status,
                    last_seen,
                    last_scan_time,
                    total_scans,
                    uptime_seconds,
                    created_at,
                    updated_at,
                    CASE 
                        WHEN last_seen < NOW() - INTERVAL '2 minutes' 
                        THEN 'this endpoint is dead'
                    END as message
                FROM endpoint_health 
                WHERE endpoint_id = ${endpoint_id}
            `;

            if (result.length === 0) {
                await sql.end();
                return NextResponse.json(
                    { error: `Endpoint ${endpoint_id} not found` },
                    { status: 404 }
                );
            }

            // Log dead endpoints
            if (result[0].status === 'offline') {
                console.log(`this endpoint is dead: ${endpoint_id}`);
            }

        } else {
            // Get all endpoints
            result = await sql`
                SELECT 
                    endpoint_id,
                    CASE 
                        WHEN last_seen > NOW() - INTERVAL '2 minutes' THEN status
                        ELSE 'offline'
                    END as status,
                    last_seen,
                    last_scan_time,
                    total_scans,
                    uptime_seconds,
                    created_at,
                    updated_at,
                    CASE 
                        WHEN last_seen < NOW() - INTERVAL '2 minutes' 
                        THEN 'this endpoint is dead'
                    END as message
                FROM endpoint_health 
                ORDER BY 
                    CASE WHEN last_seen > NOW() - INTERVAL '2 minutes' THEN 0 ELSE 1 END,
                    last_seen DESC
            `;

            // Log dead endpoints
            result.forEach(ep => {
                if (ep.status === 'offline') {
                    console.log(`this endpoint is dead: ${ep.endpoint_id}`);
                }
            });
        }

        await sql.end();

        return NextResponse.json({
            success: true,
            count: result.length,
            endpoints: endpoint_id ? result[0] : result
        });
    } catch (error) {
        console.error('Error fetching endpoints:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch endpoints',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}