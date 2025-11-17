import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';
import { rssiToDistance, trilaterate } from '@/app/lib/localization';

const sql = postgres(process.env.POSTGRES_URL!);

interface ScanData {
  mac: string;
  rssi: number;
  timestamp: Date;
  endpoint_id: string;
  x: number;
  y: number;
}

// GET /api/query/heatmap-data
// Returns wifi scan data formatted for heatmap visualization
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mac = searchParams.get('mac'); // Optional: filter by specific MAC address

    let scans;
    
    if (mac) {
      // Get latest scans for specific device from all endpoints
      scans = await sql`
        SELECT DISTINCT ON (ws.endpoint_id)
          ws.mac,
          ws.rssi,
          ws.timestamp,
          ws.endpoint_id,
          ep.x,
          ep.y
        FROM wifi_scans ws
        LEFT JOIN endpoint_positions ep ON ws.endpoint_id = ep.endpoint_id
        WHERE ws.mac = ${mac} AND ep.is_active = true
        ORDER BY ws.endpoint_id, ws.timestamp DESC
      `;
    } else {
      // Get latest scans for each device from each endpoint
      scans = await sql`
        SELECT DISTINCT ON (ws.mac, ws.endpoint_id)
          ws.mac,
          ws.rssi,
          ws.timestamp,
          ws.endpoint_id,
          ep.x,
          ep.y
        FROM wifi_scans ws
        LEFT JOIN endpoint_positions ep ON ws.endpoint_id = ep.endpoint_id
        WHERE ep.is_active = true
        ORDER BY ws.mac, ws.endpoint_id, ws.timestamp DESC
      `;
    }

    // Group scans by MAC address to calculate device positions
    const deviceScans = new Map<string, ScanData[]>();
    
    for (const scan of scans) {
      if (!deviceScans.has(scan.mac)) {
        deviceScans.set(scan.mac, []);
      }
      deviceScans.get(scan.mac)!.push(scan as ScanData);
    }

    // Calculate device positions using trilateration
    const heatmapData = [];
    
    for (const [mac, scanList] of deviceScans.entries()) {
      // Convert RSSI to distances and prepare for trilateration
      const scansWithDistance = scanList
        .filter(scan => scan.x !== null && scan.y !== null) // Only include scans with endpoint positions
        .map(scan => ({
          endpoint_id: scan.endpoint_id,
          rssi: scan.rssi,
          distance: rssiToDistance(scan.rssi),
          position: { x: scan.x, y: scan.y }
        }));

      // Need at least 3 endpoints for trilateration
      if (scansWithDistance.length >= 3) {
        const position = trilaterate(scansWithDistance);
        
        if (position) {
          // Use the strongest (least negative) RSSI from the most recent scans for heat intensity
          const maxRssi = Math.max(...scanList.map(s => s.rssi));
          const latestTimestamp = Math.max(...scanList.map(s => new Date(s.timestamp).getTime()));
          
          heatmapData.push({
            x: Math.round(position.x),
            y: Math.round(position.y),
            value: Math.max(0, 100 + maxRssi), // Convert RSSI to 0-100 scale
            mac: mac,
            rssi: maxRssi,
            timestamp: new Date(latestTimestamp).toISOString(),
            endpoint_count: scansWithDistance.length
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: heatmapData.length,
      data: {
        max: 100,
        min: 0,
        data: heatmapData
      }
    });
  } catch (error) {
    console.error('Heatmap data error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch heatmap data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
