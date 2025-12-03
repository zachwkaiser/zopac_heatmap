import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

// GET /api/query/endpoints
// Returns all endpoint positions (public endpoint for client use)
export async function GET() {
  try {
    const sql = getDb();

    const positions = await sql`
      SELECT 
        endpoint_id,
        x,
        y,
        z,
        is_active,
        created_at,
        updated_at
      FROM endpoint_positions
      ORDER BY endpoint_id
    `;

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
