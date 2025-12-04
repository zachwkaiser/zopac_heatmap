import { NextRequest, NextResponse } from 'next/server';
import { rssiToDistance, trilaterate } from '@/app/lib/localization';
import { getDb, resetDb } from '@/app/lib/db';

interface ScanData {
  mac: string;
  rssi: number;
  timestamp: Date;
  endpoint_id: string;
  x: number;
  y: number;
  z?: number;
}

// GET /api/query/heatmap-data
// Returns wifi scan data formatted for heatmap visualization
export async function GET(request: NextRequest) {
  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const sql = getDb();

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
          ep.y,
          ep.z
        FROM wifi_scans ws
        LEFT JOIN endpoint_positions ep ON ws.endpoint_id = ep.endpoint_id
        WHERE ws.mac = ${mac} AND ep.is_active = true
        ORDER BY ws.endpoint_id, ws.timestamp DESC
      `;
    } else {
      // Get latest scans for each device from each endpoint (limit to recent data)
      scans = await sql`
        SELECT DISTINCT ON (ws.mac, ws.endpoint_id)
          ws.mac,
          ws.rssi,
          ws.timestamp,
          ws.endpoint_id,
          ep.x,
          ep.y,
          ep.z
        FROM wifi_scans ws
        LEFT JOIN endpoint_positions ep ON ws.endpoint_id = ep.endpoint_id
        WHERE ep.is_active = true 
          AND ws.created_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY ws.mac, ws.endpoint_id, ws.timestamp DESC
        LIMIT 1000
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
          position: { x: scan.x, y: scan.y, z: scan.z || 0 }
        }));

      // Need at least 3 endpoints for trilateration
      if (scansWithDistance.length >= 3) {
        const position = trilaterate(scansWithDistance);
        
        if (position) {
          // Use uniform value for all devices so heatmap shows density, not signal strength
          const maxRssi = Math.max(...scanList.map(s => s.rssi));
          const latestTimestamp = Math.max(...scanList.map(s => new Date(s.timestamp).getTime()));
          
          heatmapData.push({
            x: Math.round(position.x),
            y: Math.round(position.y),
            value: 100, // Uniform value - color will represent device density
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
      
      // If connection error and we have retries left, reset connection and retry
      if (retries < maxRetries && error instanceof Error && 
          (error.message.includes('TIMEOUT') || error.message.includes('CONNECTION'))) {
        console.log(`[Heatmap] Retrying after connection error (attempt ${retries + 1}/${maxRetries})`);
        resetDb();
        retries++;
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
        continue;
      }
      
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
  
  // Should never reach here
  return NextResponse.json(
    { success: false, error: 'Max retries exceeded' },
    { status: 500 }
  );
}
