import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const runtime = "nodejs"; // needed for postgres in the App Router

// ---- Auth helper ----------------------------------------------------------
function isAuthorized(req: Request): boolean {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("ApiKey ") ? header.slice(7) : null;
  return !!(token && process.env.API_KEY && token === process.env.API_KEY);
}

// ---- Validation helpers (your originals, with MAC normalization added) ----

// Validate MAC address format (xx:xx:xx:xx:xx:xx)
function isValidMacAddress(mac: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}[:]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

// Normalize MAC to lowercase with colons (accepts "-" and converts it)
function normalizeMac(mac: string): string {
  return mac.trim().toLowerCase().replace(/-/g, ":");
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
// Protected by API key
export async function POST(request: Request) {
  // 1) Authorize early
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // 2) Support {records:[...]}, [...] or single {...}
    const scans: any[] = Array.isArray(body?.records)
      ? body.records
      : Array.isArray(body)
      ? body
      : [body];

    // 3) Validate per-scan (don’t let one bad scan block others)
    const errorDetails: Array<{ index: number; errors: string[] }> = [];
    const validScans: Array<{ endpoint_id: string; mac: string; rssi: number; timestamp: string }> = [];

    scans.forEach((scan, index) => {
      const errs: string[] = [];
      let { endpoint_id, mac, rssi, timestamp } = scan ?? {};

      if (!endpoint_id || typeof endpoint_id !== 'string') {
        errs.push(`Scan ${index}: endpoint_id is required and must be a string`);
      }

      if (!mac || typeof mac !== 'string') {
        errs.push(`Scan ${index}: mac is required and must be a string`);
      } else {
        mac = normalizeMac(mac);
        if (!isValidMacAddress(mac)) {
          errs.push(`Scan ${index}: invalid MAC address format (expected xx:xx:xx:xx:xx:xx)`);
        }
      }

      if (rssi === undefined || rssi === null) {
        errs.push(`Scan ${index}: rssi is required`);
      } else if (!isValidRSSI(rssi)) {
        errs.push(`Scan ${index}: rssi must be an integer between -100 and 0`);
      }

      if (!timestamp) {
        errs.push(`Scan ${index}: timestamp is required`);
      } else if (!isValidTimestamp(timestamp)) {
        errs.push(`Scan ${index}: invalid timestamp format`);
      }

      if (errs.length) {
        errorDetails.push({ index, errors: errs });
      } else {
        validScans.push({ endpoint_id, mac, rssi, timestamp });
      }
    });

    if (validScans.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errorDetails },
        { status: 400 }
      );
    }

    // 4) Insert valid scans into database (keep your insert style, ensure close in finally)
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    try {
      const insertedScans = await Promise.all(
        validScans.map(scan =>
          sql`
            INSERT INTO wifi_scans (endpoint_id, mac, rssi, timestamp)
            VALUES (${scan.endpoint_id}, ${scan.mac}, ${scan.rssi}, ${scan.timestamp})
            RETURNING id, endpoint_id, mac, rssi, timestamp, created_at
          `
        )
      );

      return NextResponse.json(
        {
          success: true,
          message: `Successfully stored ${insertedScans.length} scan(s)`,
          rejected: errorDetails.length,
          rejected_details: errorDetails.length ? errorDetails : undefined,
          data: insertedScans.flat(),
        },
        { status: errorDetails.length ? 207 /* multi-status-ish */ : 201 }
      );
    } catch (error: any) {
      // Preserve your table-not-found hint
      if (error instanceof Error && error.message.includes('relation "wifi_scans" does not exist')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database table not initialized',
            hint: 'Run POST /api/endpoint/setup-db first to create the table'
          },
          { status: 500 }
        );
      }
      throw error;
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch (error) {
    console.error('Scan data endpoint error:', error);
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
    const limit = parseInt(searchParams.get('limit') || '100', 10) || 100;

    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: 5432,
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    try {
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

      return NextResponse.json({
        success: true,
        count: scans.length,
        data: scans
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
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
