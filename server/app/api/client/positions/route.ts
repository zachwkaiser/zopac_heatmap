import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import postgres from 'postgres';

/**
 * Client-accessible route for endpoint positions
 * Directly accesses the database without requiring API key from client
 */

// GET /api/client/positions - Fetch endpoint positions
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
      SELECT endpoint_id, x, y, z, is_active, created_at, updated_at
      FROM endpoint_positions
      ORDER BY endpoint_id;
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      count: positions.length,
      positions: positions
    });
  } catch (error) {
    console.error('Error fetching endpoint positions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch endpoint positions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/client/positions - Update endpoint position
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.endpoint_id || typeof body.endpoint_id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'endpoint_id is required and must be a string'
        },
        { status: 400 }
      );
    }
    if (body.x === undefined || typeof body.x !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'x coordinate is required and must be a number'
        },
        { status: 400 }
      );
    }
    if (body.y === undefined || typeof body.y !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'y coordinate is required and must be a number'
        },
        { status: 400 }
      );
    }

    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    const result = await sql`
      UPDATE endpoint_positions
      SET 
        x = ${body.x},
        y = ${body.y},
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint_id = ${body.endpoint_id}
      RETURNING *;
    `;

    await sql.end();

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Endpoint position not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Updated endpoint position for ${body.endpoint_id}`,
      data: result[0]
    });
  } catch (error) {
    console.error('Error updating endpoint position:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update endpoint position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/client/positions - Create/batch update endpoint positions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support single position or batch
    const positions = Array.isArray(body) ? body : [body];

    // Validate each position
    const errors: string[] = [];
    positions.forEach((pos, index) => {
      if (!pos.endpoint_id || typeof pos.endpoint_id !== 'string') {
        errors.push(`Position ${index}: endpoint_id is required and must be a string`);
      }
      if (pos.x === undefined || typeof pos.x !== 'number') {
        errors.push(`Position ${index}: x coordinate is required and must be a number`);
      }
      if (pos.y === undefined || typeof pos.y !== 'number') {
        errors.push(`Position ${index}: y coordinate is required and must be a number`);
      }
      if (pos.z !== undefined && typeof pos.z !== 'number') {
        errors.push(`Position ${index}: z coordinate must be a number`);
      }
      if (pos.floor !== undefined && typeof pos.floor !== 'number') {
        errors.push(`Position ${index}: floor must be a number`);
      }
    });

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors
        },
        { status: 400 }
      );
    }

    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    // Insert or update positions
    const results = await Promise.all(
      positions.map(async (pos) => {
        const result = await sql`
          INSERT INTO endpoint_positions (endpoint_id, x, y, z, floor_number, updated_at)
          VALUES (
            ${pos.endpoint_id},
            ${pos.x},
            ${pos.y},
            ${pos.z || 0},
            ${pos.floor || 1},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (endpoint_id) 
          DO UPDATE SET
            x = EXCLUDED.x,
            y = EXCLUDED.y,
            z = EXCLUDED.z,
            floor_number = EXCLUDED.floor_number,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *;
        `;
        return result[0];
      })
    );

    await sql.end();

    return NextResponse.json(
      {
        success: true,
        message: `Successfully stored ${results.length} endpoint position(s)`,
        data: results
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error storing endpoint positions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to store endpoint positions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
