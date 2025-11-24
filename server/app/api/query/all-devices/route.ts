import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import {
  rssiToDistance,
  trilaterate,
  type ScanWithDistance,
  type Position,
} from '../../../lib/localization';

interface DeviceLocation {
  mac: string;
  position: Position | null;
  floor: number | null;
  scans_used: number;
  accuracy_estimate: number | null;
  method: string | null;
  timestamp: Date;
}

// Helper function to calculate location for a single device
async function calculateLocation(
  sql: postgres.Sql,
  mac: string,
  maxAge: number,
  minRssi: number
): Promise<DeviceLocation> {
  const cutoffTime = new Date(Date.now() - maxAge * 1000);
  
  const scans = await sql`
    SELECT 
      ws.endpoint_id,
      ws.mac,
      ws.rssi,
      ws.timestamp,
      ep.x,
      ep.y,
      ep.z,
      ep.floor
    FROM wifi_scans ws
    JOIN endpoint_positions ep ON ws.endpoint_id = ep.endpoint_id
    WHERE ws.mac = ${mac}
      AND ws.timestamp >= ${cutoffTime}
      AND ws.rssi >= ${minRssi}
    ORDER BY ws.timestamp DESC;
  `;

  if (scans.length === 0) {
    return {
      mac,
      position: null,
      floor: null,
      scans_used: 0,
      accuracy_estimate: null,
      method: null,
      timestamp: new Date(),
    };
  }

  // Group scans by endpoint and get most recent from each
  const latestByEndpoint = new Map<string, typeof scans[0]>();
  for (const scan of scans) {
    const existing = latestByEndpoint.get(scan.endpoint_id);
    if (!existing || new Date(scan.timestamp) > new Date(existing.timestamp)) {
      latestByEndpoint.set(scan.endpoint_id, scan);
    }
  }

  // Convert to scan data with distances
  const scansWithDistance: ScanWithDistance[] = Array.from(latestByEndpoint.values()).map(scan => ({
    endpoint_id: scan.endpoint_id,
    rssi: scan.rssi,
    distance: rssiToDistance(scan.rssi),
    position: {
      x: scan.x,
      y: scan.y,
      z: scan.z || 0
    }
  }));

  // Calculate position using trilateration
  const position = trilaterate(scansWithDistance);
  
  // Get floor from most common floor in scans
  const floors = Array.from(latestByEndpoint.values()).map(s => s.floor).filter(f => f !== null);
  const floor = floors.length > 0 ? Math.round(floors.reduce((a, b) => a + b, 0) / floors.length) : null;

  // Calculate accuracy estimate (average distance to endpoints)
  const avgDistance = scansWithDistance.reduce((sum, s) => sum + s.distance, 0) / scansWithDistance.length;
  
  return {
    mac,
    position,
    floor,
    scans_used: scansWithDistance.length,
    accuracy_estimate: position ? avgDistance : null,
    method: position ? (scansWithDistance.length >= 3 ? 'trilateration' : 'centroid') : null,
    timestamp: new Date(scans[0].timestamp),
  };
}

// GET: Query all active devices in the room
// Query params:
//   ?max_age=60 (optional, only devices seen in last X seconds, default 60)
//   ?min_rssi=-90 (optional, filter weak signals, default -90)
//   ?floor=1 (optional, filter by floor)
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
    const maxAge = searchParams.get('max_age') ? parseInt(searchParams.get('max_age')!) : 60;
    const minRssi = searchParams.get('min_rssi') ? parseInt(searchParams.get('min_rssi')!) : -90;
    const floor = searchParams.get('floor') ? parseInt(searchParams.get('floor')!) : null;

    // Get all unique MACs that have been seen recently
    const cutoffTime = new Date(Date.now() - maxAge * 1000);
    
    let uniqueMacsQuery;
    if (floor !== null) {
      uniqueMacsQuery = sql`
        SELECT DISTINCT ws.mac
        FROM wifi_scans ws
        JOIN endpoint_positions ep ON ws.endpoint_id = ep.endpoint_id
        WHERE ws.timestamp >= ${cutoffTime}
          AND ws.rssi >= ${minRssi}
          AND ep.floor = ${floor}
        ORDER BY ws.mac
      `;
    } else {
      uniqueMacsQuery = sql`
        SELECT DISTINCT mac
        FROM wifi_scans
        WHERE timestamp >= ${cutoffTime}
          AND rssi >= ${minRssi}
        ORDER BY mac
      `;
    }

    const uniqueMacs = await uniqueMacsQuery;

    if (uniqueMacs.length === 0) {
      await sql.end();
      return NextResponse.json({
        success: true,
        count: 0,
        devices: [],
        query_params: {
          max_age_seconds: maxAge,
          min_rssi: minRssi,
          floor: floor,
        }
      });
    }

    // Calculate location for each device
    const deviceLocations: DeviceLocation[] = [];

    for (const { mac } of uniqueMacs) {
      const location = await calculateLocation(sql, mac, maxAge, minRssi);
      
      if (location.position) {
        deviceLocations.push(location);
      }
    }

    await sql.end();

    // Sort by floor, then by x coordinate
    deviceLocations.sort((a, b) => {
      if (a.floor !== b.floor) {
        return (a.floor || 0) - (b.floor || 0);
      }
      return (a.position?.x || 0) - (b.position?.x || 0);
    });

    return NextResponse.json({
      success: true,
      count: deviceLocations.length,
      query_params: {
        max_age_seconds: maxAge,
        min_rssi: minRssi,
        floor: floor,
      },
      devices: deviceLocations.map(device => ({
        mac: device.mac,
        position: device.position,
        floor: device.floor,
        accuracy_estimate: device.accuracy_estimate,
        scans_used: device.scans_used,
        method: device.method,
        timestamp: device.timestamp,
      })),
      debug: {
        total_macs_found: uniqueMacs.length,
        locations_calculated: deviceLocations.length,
      }
    });
  } catch (error) {
    console.error('Bulk device query error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to query devices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Query specific list of devices
// Body: { "macs": ["aa:bb:cc:dd:ee:ff", "11:22:33:44:55:66"], "max_age": 60, "min_rssi": -90 }
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
    const { macs, max_age = 60, min_rssi = -90 } = body;

    // Validate input
    if (!macs || !Array.isArray(macs) || macs.length === 0) {
      await sql.end();
      return NextResponse.json(
        { error: 'macs array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Normalize MACs to lowercase
    const normalizedMacs = macs.map((mac: string) => mac.toLowerCase());

    // Calculate location for each device
    const deviceLocations: DeviceLocation[] = [];

    for (const mac of normalizedMacs) {
      const location = await calculateLocation(sql, mac, max_age, min_rssi);
      deviceLocations.push(location);
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      count: deviceLocations.length,
      query_params: {
        max_age_seconds: max_age,
        min_rssi: min_rssi,
      },
      devices: deviceLocations.map(device => ({
        mac: device.mac,
        position: device.position,
        floor: device.floor,
        accuracy_estimate: device.accuracy_estimate,
        scans_used: device.scans_used,
        method: device.method,
        timestamp: device.timestamp,
      })),
    });
  } catch (error) {
    console.error('Bulk device query error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to query devices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

