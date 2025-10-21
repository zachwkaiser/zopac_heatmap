import { NextResponse } from 'next/server';
import postgres from 'postgres';

// Test database connectivity endpoint
// Protected by API key middleware
export async function GET() {
  try {
    // Create database connection
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    });

    // Test query
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    await sql.end();

    return NextResponse.json({
      ok: true,
      message: 'Database connection successful',
      data: {
        current_time: result[0].current_time,
        db_version: result[0].db_version,
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
