import { NextResponse } from 'next/server';
import postgres from 'postgres';

// Migrate database schema to add missing columns
// Run this once on cloud database to fix schema issues
export async function POST() {
  try {
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    const migrations: string[] = [];

    try {
      // Check if created_at exists in wifi_scans
      const wifiScansColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'wifi_scans' AND column_name = 'created_at'
      `;

      if (wifiScansColumns.length === 0) {
        await sql`
          ALTER TABLE wifi_scans 
          ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        `;
        migrations.push('Added created_at column to wifi_scans');
      } else {
        migrations.push('wifi_scans.created_at already exists');
      }

      // Check if z exists in endpoint_positions
      const endpointPosColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'endpoint_positions' AND column_name = 'z'
      `;

      if (endpointPosColumns.length === 0) {
        await sql`
          ALTER TABLE endpoint_positions 
          ADD COLUMN z FLOAT DEFAULT 0
        `;
        migrations.push('Added z column to endpoint_positions');
      } else {
        migrations.push('endpoint_positions.z already exists');
      }

      await sql.end();

      return NextResponse.json({
        success: true,
        message: 'Database migration completed',
        migrations
      });
    } catch (innerError) {
      await sql.end();
      throw innerError;
    }
  } catch (error) {
    console.error('Database migration error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to migrate database schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
