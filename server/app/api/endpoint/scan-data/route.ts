import { NextResponse } from 'next/server';
import postgres from 'postgres';

// Validate MAC address format (XX:XX:XX:XX:XX:XX)
function isValidMacAddress(mac: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

// Validate RSSI range (typically -100 to 0 dBm)
function isValidRSSI(rssi: number): boolean {
  return Number.isInteger(rssi) && rssi >= -100 && rssi <= 0;
}

// Validate timestamp format (ISO 8601 or valid date string)
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

// POST /api/endpoint/scan-data
// Receives Wi-Fi scan data from Raspberry Pi endpoints
// Protected by API key middleware
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Support both single scan and batch scans
    const scans = Array.isArray(body) ? body : [body];
    
    // Validate all scans
    const errors: string[] = [];
    const validScans: any[] = [];
    
    scans.forEach((scan, index) => {
      const { endpoint_id, mac, rssi, timestamp } = scan;
      
      // Validate required fields
      if (!endpoint_id || typeof endpoint_id !== 'string') {
        errors.push(`Scan ${index}: endpoint_id is required and must be a string`);
      }
      if (!mac || typeof mac !== 'string') {
        errors.push(`Scan ${index}: mac is required and must be a string`);
      } else if (!isValidMacAddress(mac)) {
        errors.push(`Scan ${index}: invalid MAC address format (expected XX:XX:XX:XX:XX:XX)`);
      }
      if (rssi === undefined || rssi === null) {
        errors.push(`Scan ${index}: rssi is required`);
      } else if (!isValidRSSI(rssi)) {
        errors.push(`Scan ${index}: rssi must be an integer between -100 and 0`);
      }
      if (!timestamp) {
        errors.push(`Scan ${index}: timestamp is required`);
      } else if (!isValidTimestamp(timestamp)) {
        errors.push(`Scan ${index}: invalid timestamp format`);
      }
      
      // If no errors for this scan, add to valid list
      if (errors.length === 0) {
        validScans.push({ endpoint_id, mac, rssi, timestamp });
      }
    });
    
    // If there are validation errors, return them
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
    
    // Insert valid scans into database
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });
    
    // Insert all scans
    const insertedScans = await Promise.all(
      validScans.map(scan => 
        sql`
          INSERT INTO wifi_scans (endpoint_id, mac, rssi, timestamp)
          VALUES (${scan.endpoint_id}, ${scan.mac}, ${scan.rssi}, ${scan.timestamp})
          RETURNING id, endpoint_id, mac, rssi, timestamp, created_at
        `
      )
    );
    
    await sql.end();
    
    return NextResponse.json({
      success: true,
      message: `Successfully stored ${insertedScans.length} scan(s)`,
      data: insertedScans.flat()
    }, { status: 201 });
    
  } catch (error) {
    console.error('Scan data endpoint error:', error);
    
    // Check for specific database errors
    if (error instanceof Error) {
      if (error.message.includes('relation "wifi_scans" does not exist')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Database table not initialized',
            hint: 'Run POST /api/endpoint/setup-db first to create the table'
          },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to store scan data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/endpoint/scan-data
// Retrieve stored scan data (for testing/debugging)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint_id = searchParams.get('endpoint_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });
    
    let scans;
    if (endpoint_id) {
      scans = await sql`
        SELECT * FROM wifi_scans 
        WHERE endpoint_id = ${endpoint_id}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
    } else {
      scans = await sql`
        SELECT * FROM wifi_scans 
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
    }
    
    await sql.end();
    
    return NextResponse.json({
      success: true,
      count: scans.length,
      data: scans
    });
    
  } catch (error) {
    console.error('Get scan data error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve scan data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
