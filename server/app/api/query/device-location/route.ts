import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { 
  rssiToDistance, 
  trilaterate, 
  type ScanWithDistance,
  type Position 
} from '@/app/lib/localization';

// Query device location by MAC address
// Client-facing endpoint (no API key required, uses NextAuth session in production)

interface DeviceLocation {
  mac: string;
  position: Position | null;
  timestamp: Date;
  scans_used: number;
  accuracy_estimate?: number;
  floor?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mac = searchParams.get('mac');
    const maxAgeSeconds = parseInt(searchParams.get('max_age') || '60');
    const minRssi = parseInt(searchParams.get('min_rssi') || '-90');

    if (!mac) {
      return NextResponse.json(
        {
          success: false,
          error: 'MAC address is required (use ?mac=XX:XX:XX:XX:XX:XX)'
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

    // Get recent scans for this MAC address
    const cutoffTime = new Date(Date.now() - maxAgeSeconds * 1000);
    
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
      await sql.end();
      return NextResponse.json({
        success: true,
        message: 'No recent scans found for this device',
        data: {
          mac,
          position: null,
          scans_used: 0,
          timestamp: new Date()
        }
      });
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
        y: scan.y
      }
    }));

    // Calculate position using trilateration
    const position = trilaterate(scansWithDistance);

    // Calculate accuracy estimate (average distance to endpoints)
    let accuracyEstimate: number | undefined;
    if (position && scansWithDistance.length > 0) {
      const distances = scansWithDistance.map(s => s.distance);
      accuracyEstimate = distances.reduce((a, b) => a + b, 0) / distances.length;
    }

    // Get floor from majority of scans
    const floors = scans.map(s => s.floor).filter(f => f !== null);
    const floor = floors.length > 0 
      ? floors.sort((a, b) => 
          floors.filter(f => f === a).length - floors.filter(f => f === b).length
        ).pop()
      : 1;

    await sql.end();

    const result: DeviceLocation = {
      mac,
      position,
      timestamp: new Date(scans[0].timestamp),
      scans_used: scansWithDistance.length,
      accuracy_estimate: accuracyEstimate,
      floor
    };

    return NextResponse.json({
      success: true,
      data: result,
      debug: {
        total_scans: scans.length,
        endpoints_detected: scansWithDistance.length,
        scans: scansWithDistance.map(s => ({
          endpoint_id: s.endpoint_id,
          rssi: s.rssi,
          distance_meters: s.distance.toFixed(2),
          position: s.position
        }))
      }
    });
  } catch (error) {
    console.error('Error calculating device location:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate device location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get locations for multiple devices at once
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { macs, max_age = 60, min_rssi = -90 } = body;

    if (!Array.isArray(macs) || macs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'macs array is required'
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

    const cutoffTime = new Date(Date.now() - max_age * 1000);

    // Get scans for all MACs
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
      WHERE ws.mac = ANY(${macs})
        AND ws.timestamp >= ${cutoffTime}
        AND ws.rssi >= ${min_rssi}
      ORDER BY ws.mac, ws.timestamp DESC;
    `;

    // Group by MAC address
    const scansByMac = new Map<string, Array<typeof scans[0]>>();
    for (const scan of scans) {
      if (!scansByMac.has(scan.mac)) {
        scansByMac.set(scan.mac, []);
      }
      scansByMac.get(scan.mac)!.push(scan);
    }

    // Calculate location for each device
    const locations: DeviceLocation[] = [];
    
    for (const mac of macs) {
      const deviceScans = scansByMac.get(mac) || [];
      
      if (deviceScans.length === 0) {
        locations.push({
          mac,
          position: null,
          timestamp: new Date(),
          scans_used: 0
        });
        continue;
      }

      // Get latest scan from each endpoint
      const latestByEndpoint = new Map<string, typeof deviceScans[0]>();
      for (const scan of deviceScans) {
        const existing = latestByEndpoint.get(scan.endpoint_id);
        if (!existing || new Date(scan.timestamp) > new Date(existing.timestamp)) {
          latestByEndpoint.set(scan.endpoint_id, scan);
        }
      }

      const scansWithDistance: ScanWithDistance[] = Array.from(latestByEndpoint.values()).map(scan => ({
        endpoint_id: scan.endpoint_id,
        rssi: scan.rssi,
        distance: rssiToDistance(scan.rssi),
        position: { x: scan.x, y: scan.y, z: scan.z || 0 }
      }));

      const position = trilaterate(scansWithDistance);
      
      let accuracyEstimate: number | undefined;
      if (position && scansWithDistance.length > 0) {
        const distances = scansWithDistance.map(s => s.distance);
        accuracyEstimate = distances.reduce((a, b) => a + b, 0) / distances.length;
      }

      const floors = deviceScans.map(s => s.floor).filter(f => f !== null);
      const floor = floors.length > 0 
        ? floors.sort((a, b) => 
            floors.filter(f => f === a).length - floors.filter(f => f === b).length
          ).pop()
        : 1;

      locations.push({
        mac,
        position,
        timestamp: new Date(deviceScans[0].timestamp),
        scans_used: scansWithDistance.length,
        accuracy_estimate: accuracyEstimate,
        floor
      });
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      count: locations.length,
      data: locations
    });
  } catch (error) {
    console.error('Error calculating device locations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate device locations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
