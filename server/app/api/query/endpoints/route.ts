import { NextResponse } from 'next/server';
import postgres from 'postgres';

// GET /api/query/endpoints
// Returns all endpoint positions (public endpoint for client use)
export async function GET() {
  try {
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    const positions = await sql`
      SELECT 
        endpoint_id,
        x,
        y,
        is_active,
        created_at,
        updated_at
      FROM endpoint_positions
      ORDER BY endpoint_id
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      count: positions.length,
      positions: positions
    });
  } catch (error) {
    console.error('Get endpoint positions error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch endpoint positions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
