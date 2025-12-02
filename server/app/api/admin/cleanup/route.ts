import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const runtime = "nodejs";

// Admin endpoint to clean up old data
// Protected by API key
export async function POST(request: Request) {
  try {
    // Check API key
    const apiKey = request.headers.get('x-api-key');
    const validKey = process.env.ENDPOINT_API_KEY || process.env.API_KEY;
    
    if (!apiKey || apiKey !== validKey) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { days = 7 } = body; // Default: keep last 7 days

    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Delete old wifi_scans
      const deletedScans = await sql`
        DELETE FROM wifi_scans
        WHERE timestamp < ${cutoffDate.toISOString()}
        RETURNING id
      `;

      // Delete test users (keep only real users)
      const deletedUsers = await sql`
        DELETE FROM users
        WHERE email LIKE 'test%@%'
        RETURNING id
      `;

      await sql.end();

      return NextResponse.json({
        success: true,
        message: 'Cleanup completed',
        details: {
          scans_deleted: deletedScans.length,
          users_deleted: deletedUsers.length,
          cutoff_date: cutoffDate.toISOString(),
          days_kept: days
        }
      });
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clean up data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check data statistics
export async function GET(request: Request) {
  try {
    // Check API key
    const apiKey = request.headers.get('x-api-key');
    const validKey = process.env.ENDPOINT_API_KEY || process.env.API_KEY;
    
    if (!apiKey || apiKey !== validKey) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing API key' },
        { status: 401 }
      );
    }

    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    try {
      // Count total scans
      const scanCount = await sql`
        SELECT COUNT(*) as count FROM wifi_scans
      `;

      // Count scans by age
      const last24h = await sql`
        SELECT COUNT(*) as count FROM wifi_scans
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `;

      const last7days = await sql`
        SELECT COUNT(*) as count FROM wifi_scans
        WHERE timestamp >= NOW() - INTERVAL '7 days'
      `;

      // Count users
      const userCount = await sql`
        SELECT COUNT(*) as count FROM users
      `;

      const testUserCount = await sql`
        SELECT COUNT(*) as count FROM users
        WHERE email LIKE 'test%@%'
      `;

      // Oldest scan
      const oldest = await sql`
        SELECT timestamp FROM wifi_scans
        ORDER BY timestamp ASC
        LIMIT 1
      `;

      await sql.end();

      return NextResponse.json({
        success: true,
        statistics: {
          total_scans: parseInt(scanCount[0].count),
          scans_last_24h: parseInt(last24h[0].count),
          scans_last_7days: parseInt(last7days[0].count),
          total_users: parseInt(userCount[0].count),
          test_users: parseInt(testUserCount[0].count),
          oldest_scan: oldest[0]?.timestamp || null
        }
      });
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('Statistics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
