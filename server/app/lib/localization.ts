// Localization utilities for WiFi-based indoor positioning

export interface Position {
  x: number;
  y: number;
}

export interface EndpointPosition extends Position {
  endpoint_id: string;
  floor?: number;
}

export interface ScanWithDistance {
  endpoint_id: string;
  rssi: number;
  distance: number;
  position: Position;
}

/**
 * Convert RSSI (signal strength) to estimated distance in meters
 * Uses the log-distance path loss model: RSSI = A - 10*n*log10(d)
 * 
 * @param rssi - Received Signal Strength Indicator (typically -30 to -90 dBm)
 * @param txPower - Transmit power at 1 meter (default -59 dBm for typical WiFi)
 * @param pathLossExponent - Environment-dependent path loss exponent (2-4, default 2.5 for indoor)
 * @returns Estimated distance in meters
 */
export function rssiToDistance(
  rssi: number,
  txPower: number = -59,
  pathLossExponent: number = 2.5
): number {
  if (rssi === 0) {
    return -1.0; // Invalid signal
  }

  // Calculate distance using path loss formula
  // d = 10^((txPower - RSSI) / (10 * n))
  const ratio = (txPower - rssi) / (10 * pathLossExponent);
  const distance = Math.pow(10, ratio);

  return distance;
}

/**
 * Calculate device position using trilateration with 3+ endpoints
 * Uses least squares method for overdetermined systems (>3 points)
 * 
 * @param scans - Array of scans with endpoint positions and distances
 * @returns Estimated position {x, y} or null if insufficient data
 */
export function trilaterate(scans: ScanWithDistance[]): Position | null {
  if (scans.length < 3) {
    return null; // Need at least 3 points for 2D trilateration
  }

  // Use least squares method for better accuracy with multiple points
  // Minimize sum of squared errors: (x - x_i)^2 + (y - y_i)^2 = d_i^2
  
  let A: number[][] = [];
  let b: number[] = [];

  // Use first point as reference
  const ref = scans[0];
  
  for (let i = 1; i < scans.length; i++) {
    const curr = scans[i];
    
    // Build linear system: 2(x_i - x_1)*x + 2(y_i - y_1)*y = ...
    const dx = curr.position.x - ref.position.x;
    const dy = curr.position.y - ref.position.y;
    
    const rightSide = 
      Math.pow(curr.position.x, 2) - Math.pow(ref.position.x, 2) +
      Math.pow(curr.position.y, 2) - Math.pow(ref.position.y, 2) +
      Math.pow(ref.distance, 2) - Math.pow(curr.distance, 2);
    
    A.push([2 * dx, 2 * dy]);
    b.push(rightSide);
  }

  // Solve using least squares: (A^T * A)^-1 * A^T * b
  const solution = leastSquaresSolve(A, b);
  
  if (!solution) {
    // Fallback to centroid if linear system fails
    return calculateCentroid(scans);
  }

  return {
    x: solution[0],
    y: solution[1]
  };
}

/**
 * Solve least squares problem for overdetermined linear system
 * @param A - Coefficient matrix
 * @param b - Right-hand side vector
 * @returns Solution vector [x, y] or null if singular
 */
function leastSquaresSolve(A: number[][], b: number[]): number[] | null {
  // For 2D case, solve 2x2 system from normal equations
  if (A.length < 2) return null;

  // Calculate A^T * A
  const ATA = [
    [0, 0],
    [0, 0]
  ];
  
  for (let i = 0; i < A.length; i++) {
    ATA[0][0] += A[i][0] * A[i][0];
    ATA[0][1] += A[i][0] * A[i][1];
    ATA[1][0] += A[i][1] * A[i][0];
    ATA[1][1] += A[i][1] * A[i][1];
  }

  // Calculate A^T * b
  const ATb = [0, 0];
  for (let i = 0; i < A.length; i++) {
    ATb[0] += A[i][0] * b[i];
    ATb[1] += A[i][1] * b[i];
  }

  // Solve 2x2 system using Cramer's rule
  const det = ATA[0][0] * ATA[1][1] - ATA[0][1] * ATA[1][0];
  
  if (Math.abs(det) < 1e-10) {
    return null; // Singular matrix
  }

  const x = (ATb[0] * ATA[1][1] - ATb[1] * ATA[0][1]) / det;
  const y = (ATA[0][0] * ATb[1] - ATA[1][0] * ATb[0]) / det;

  return [x, y];
}

/**
 * Calculate weighted centroid as fallback localization method
 * Weights are inverse of distance (closer endpoints have more weight)
 */
function calculateCentroid(scans: ScanWithDistance[]): Position {
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (const scan of scans) {
    // Use inverse distance as weight (closer = higher weight)
    const weight = 1 / (scan.distance + 0.1); // Add small constant to avoid division by zero
    
    weightedX += scan.position.x * weight;
    weightedY += scan.position.y * weight;
    totalWeight += weight;
  }

  return {
    x: weightedX / totalWeight,
    y: weightedY / totalWeight
  };
}

/**
 * Filter scans by recency and quality
 * @param scans - All scans for a device
 * @param maxAgeSeconds - Maximum age of scans to consider (default 60s)
 * @param minRssi - Minimum signal strength to consider (default -90 dBm)
 * @returns Filtered scans
 */
export function filterScans(
  scans: Array<{ rssi: number; timestamp: Date }>,
  maxAgeSeconds: number = 60,
  minRssi: number = -90
): Array<{ rssi: number; timestamp: Date }> {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - maxAgeSeconds * 1000);

  return scans.filter(scan => {
    return scan.timestamp >= cutoffTime && scan.rssi >= minRssi;
  });
}

/**
 * Calculate average position from multiple location estimates
 * Useful for smoothing position over time
 */
export function averagePositions(positions: Position[]): Position {
  if (positions.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = positions.reduce(
    (acc, pos) => ({
      x: acc.x + pos.x,
      y: acc.y + pos.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / positions.length,
    y: sum.y / positions.length
  };
}
