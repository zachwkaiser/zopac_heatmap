import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// ---- Auth helper ----------------------------------------------------------
function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const fromAuth = auth.startsWith("ApiKey ") ? auth.slice(7) : null;
  const fromHeader = req.headers.get("x-api-key");
  const token = fromAuth || fromHeader;

  const serverKey = process.env.ENDPOINT_API_KEY || process.env.API_KEY;
  return !!(token && serverKey && token === serverKey);
}

// POST: Update endpoint status (heartbeat)
// GET: Retrieve all endpoint statuses
export async function POST(request: NextRequest) {
  // Check API key authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or missing API key' },
      { status: 401 }
    );
  }

  try {
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    const body = await request.json();
    const { endpoint_id, status = 'online', metadata } = body;

    // Validate endpoint_id
    if (!endpoint_id) {
      await sql.end();
      return NextResponse.json(
        { error: 'endpoint_id is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['online', 'offline', 'error'];
    if (!validStatuses.includes(status)) {
      await sql.end();
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Use existing endpoint_status table (already created)
    // Upsert endpoint status
    const result = await sql`
      INSERT INTO endpoint_status (endpoint_id, status, last_seen, metadata)
      VALUES (${endpoint_id}, ${status}, CURRENT_TIMESTAMP, ${metadata ? sql.json(metadata) : null})
      ON CONFLICT (endpoint_id) 
      DO UPDATE SET 
        status = EXCLUDED.status,
        last_seen = CURRENT_TIMESTAMP,
        metadata = EXCLUDED.metadata
      RETURNING *;
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      message: 'Endpoint status updated',
      endpoint_status: {
        endpoint_id: result[0].endpoint_id,
        status: result[0].status,
        last_seen: result[0].last_seen,
        metadata: result[0].metadata,
      }
    });
  } catch (error) {
    console.error('Endpoint status update error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update endpoint status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET: Retrieve endpoint statuses
// Query params: 
//   ?endpoint_id=EP1 (optional, get specific endpoint)
//   ?status=online (optional, filter by status)
//   ?timeout=60 (optional, consider endpoints offline if not seen in X seconds)
export async function GET(request: NextRequest) {
  try {
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    const { searchParams } = new URL(request.url);
    const endpoint_id = searchParams.get('endpoint_id');
    const statusFilter = searchParams.get('status');
    const timeout = searchParams.get('timeout') ? parseInt(searchParams.get('timeout')!) : 300; // Default 5 minutes

    let result;

    if (endpoint_id) {
      // Get specific endpoint
      result = await sql`
        SELECT 
          endpoint_id,
          status,
          last_seen,
          metadata,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) as seconds_since_seen,
          CASE 
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) > ${timeout} THEN 'stale'
            ELSE status
          END as computed_status,
          created_at,
          updated_at
        FROM endpoint_status 
        WHERE endpoint_id = ${endpoint_id}
      `;

      if (result.length === 0) {
        await sql.end();
        return NextResponse.json(
          { error: `Endpoint ${endpoint_id} not found` },
          { status: 404 }
        );
      }

      await sql.end();
      return NextResponse.json({
        success: true,
        endpoint_status: {
          endpoint_id: result[0].endpoint_id,
          status: result[0].status,
          computed_status: result[0].computed_status,
          last_seen: result[0].last_seen,
          seconds_since_seen: Math.floor(result[0].seconds_since_seen),
          metadata: result[0].metadata,
          created_at: result[0].created_at,
          updated_at: result[0].updated_at,
        }
      });
    } else {
      // Get all endpoints
      let query = sql`
        SELECT 
          endpoint_id,
          status,
          last_seen,
          metadata,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) as seconds_since_seen,
          CASE 
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) > ${timeout} THEN 'stale'
            ELSE status
          END as computed_status,
          created_at,
          updated_at
        FROM endpoint_status
      `;

      // Apply status filter if provided
      if (statusFilter) {
        query = sql`
          SELECT 
            endpoint_id,
            status,
            last_seen,
            metadata,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) as seconds_since_seen,
            CASE 
              WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) > ${timeout} THEN 'stale'
              ELSE status
            END as computed_status,
            created_at,
            updated_at
          FROM endpoint_status
          WHERE status = ${statusFilter}
        `;
      }

      query = sql`${query} ORDER BY endpoint_id ASC`;
      result = await query;

      await sql.end();
      return NextResponse.json({
        success: true,
        count: result.length,
        timeout_seconds: timeout,
        endpoint_statuses: result.map(ep => ({
          endpoint_id: ep.endpoint_id,
          status: ep.status,
          computed_status: ep.computed_status,
          last_seen: ep.last_seen,
          seconds_since_seen: Math.floor(ep.seconds_since_seen),
          metadata: ep.metadata,
          created_at: ep.created_at,
          updated_at: ep.updated_at,
        }))
      });
    }
  } catch (error) {
    console.error('Endpoint status retrieval error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve endpoint status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE: Remove endpoint status
// Query params: ?endpoint_id=EP1 (required)
export async function DELETE(request: NextRequest) {
  try {
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    const { searchParams } = new URL(request.url);
    const endpoint_id = searchParams.get('endpoint_id');

    if (!endpoint_id) {
      await sql.end();
      return NextResponse.json(
        { error: 'endpoint_id parameter is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM endpoint_status 
      WHERE endpoint_id = ${endpoint_id}
      RETURNING *;
    `;

    if (result.length === 0) {
      await sql.end();
      return NextResponse.json(
        { error: `Endpoint status for ${endpoint_id} not found` },
        { status: 404 }
      );
    }

    await sql.end();
    return NextResponse.json({
      success: true,
      message: `Endpoint status for ${endpoint_id} deleted successfully`,
      deleted: {
        endpoint_id: result[0].endpoint_id,
        status: result[0].status,
      }
    });
  } catch (error) {
    console.error('Endpoint status deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete endpoint status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
