import { NextResponse } from 'next/server';
import postgres from 'postgres';

// Setup database schema for wifi_scans table
// Protected by API key middleware
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

    // Create wifi_scans table
    await sql`
      CREATE TABLE IF NOT EXISTS wifi_scans (
        id SERIAL PRIMARY KEY,
        endpoint_id VARCHAR(50) NOT NULL,
        mac VARCHAR(17) NOT NULL,
        rssi INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_endpoint_id ON wifi_scans(endpoint_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_mac ON wifi_scans(mac);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_timestamp ON wifi_scans(timestamp);`;

    // Create endpoint_positions table for localization
    await sql`
      CREATE TABLE IF NOT EXISTS endpoint_positions (
        endpoint_id VARCHAR(50) PRIMARY KEY,
        x FLOAT NOT NULL,
        y FLOAT NOT NULL,
        floor INTEGER DEFAULT 1,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      message: 'Database schema created successfully',
      tables: ['wifi_scans', 'endpoint_positions']
    });
  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create database schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
