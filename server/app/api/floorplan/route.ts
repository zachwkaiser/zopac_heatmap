import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

// POST: Upload floorplan
// GET: Retrieve floorplan
export async function POST(request: NextRequest) {
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
    const { floor = 1, name = 'Default Floorplan', width, height, image_data, image_url } = body;

    // Validate that either image_data or image_url is provided
    if (!image_data && !image_url) {
      await sql.end();
      return NextResponse.json(
        { error: 'Either image_data (base64) or image_url must be provided' },
        { status: 400 }
      );
    }

    // Validate dimensions if provided
    if ((width && width <= 0) || (height && height <= 0)) {
      await sql.end();
      return NextResponse.json(
        { error: 'Width and height must be positive numbers' },
        { status: 400 }
      );
    }

    // Use existing floorplans table (already created with floor_number column)
    // Upsert floorplan (insert or update if floor already exists)
    const result = await sql`
      INSERT INTO floorplans (floor_number, building, width, height, image_data, image_url)
      VALUES (${floor}, ${name}, ${width || null}, ${height || null}, ${image_data || null}, ${image_url || null})
      ON CONFLICT (floor_number) 
      DO UPDATE SET 
        building = EXCLUDED.building,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        image_data = EXCLUDED.image_data,
        image_url = EXCLUDED.image_url
      RETURNING *;
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      message: 'Floorplan uploaded successfully',
      floorplan: {
        floor_number: result[0].floor_number,
        building: result[0].building,
        width: result[0].width,
        height: result[0].height,
        has_image_data: !!result[0].image_data,
        image_url: result[0].image_url,
        created_at: result[0].created_at,
        updated_at: result[0].updated_at,
      }
    });
  } catch (error) {
    console.error('Floorplan upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload floorplan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET: Retrieve floorplan(s)
// Query params: ?floor=1 (optional, returns specific floor)
// If no floor specified, returns all floorplans
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
    const floor = searchParams.get('floor');

    let result;
    if (floor) {
      // Get specific floor
      result = await sql`
        SELECT * FROM floorplans 
        WHERE floor_number = ${parseInt(floor)}
      `;

      if (result.length === 0) {
        await sql.end();
        return NextResponse.json(
          { error: `Floorplan for floor ${floor} not found` },
          { status: 404 }
        );
      }

      await sql.end();
      return NextResponse.json({
        success: true,
        floorplan: {
          floor_number: result[0].floor_number,
          building: result[0].building,
          width: result[0].width,
          height: result[0].height,
          image_data: result[0].image_data,
          image_url: result[0].image_url,
          created_at: result[0].created_at,
        }
      });
    } else {
      // Get all floorplans
      result = await sql`
        SELECT * FROM floorplans 
        ORDER BY floor_number ASC
      `;

      await sql.end();
      return NextResponse.json({
        success: true,
        count: result.length,
        floorplans: result.map(fp => ({
          floor_number: fp.floor_number,
          building: fp.building,
          width: fp.width,
          height: fp.height,
          has_image_data: !!fp.image_data,
          image_url: fp.image_url,
          created_at: fp.created_at,
        }))
      });
    }
  } catch (error) {
    console.error('Floorplan retrieval error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve floorplan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE: Remove floorplan
// Query params: ?floor=1 (required)
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
    const floor = searchParams.get('floor');

    if (!floor) {
      await sql.end();
      return NextResponse.json(
        { error: 'Floor parameter is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM floorplans 
      WHERE floor = ${parseInt(floor)}
      RETURNING *;
    `;

    if (result.length === 0) {
      await sql.end();
      return NextResponse.json(
        { error: `Floorplan for floor ${floor} not found` },
        { status: 404 }
      );
    }

    await sql.end();
    return NextResponse.json({
      success: true,
      message: `Floorplan for floor ${floor} deleted successfully`,
      deleted: {
        id: result[0].id,
        floor: result[0].floor,
        name: result[0].name,
      }
    });
  } catch (error) {
    console.error('Floorplan deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete floorplan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
