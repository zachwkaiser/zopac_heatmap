import postgres from 'postgres';

// Background task to automatically clean up old WiFi scans
// Runs every minute and deletes scans older than 7 days

const CLEANUP_INTERVAL = 60 * 1000; // 1 minute in milliseconds
const DAYS_TO_KEEP = 7;

let cleanupInterval: NodeJS.Timeout | null = null;

async function cleanupOldScans() {
  console.log('[Cleanup] Starting automatic cleanup...');
  
  try {
    const sql = postgres({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DATABASE,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      ssl: false,
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);

      // Delete old wifi_scans
      const deletedScans = await sql`
        DELETE FROM wifi_scans
        WHERE timestamp < ${cutoffDate.toISOString()}
        RETURNING id
      `;

      if (deletedScans.length > 0) {
        console.log(`[Cleanup] Deleted ${deletedScans.length} old scans (older than ${DAYS_TO_KEEP} days)`);
      } else {
        console.log('[Cleanup] No old scans to delete');
      }

      await sql.end();
    } catch (error) {
      await sql.end();
      throw error;
    }
  } catch (error) {
    console.error('[Cleanup] Error during automatic cleanup:', error);
  }
}

// Start the automatic cleanup
export function startAutoCleanup() {
  if (cleanupInterval) {
    console.log('[Cleanup] Auto-cleanup already running');
    return;
  }

  console.log(`[Cleanup] Starting auto-cleanup (every ${CLEANUP_INTERVAL / 1000}s, keeping ${DAYS_TO_KEEP} days)`);
  
  // Run immediately on startup
  cleanupOldScans();
  
  // Then run every minute
  cleanupInterval = setInterval(cleanupOldScans, CLEANUP_INTERVAL);
}

// Stop the automatic cleanup
export function stopAutoCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Cleanup] Auto-cleanup stopped');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Cleanup] Received SIGTERM, stopping auto-cleanup...');
  stopAutoCleanup();
});

process.on('SIGINT', () => {
  console.log('[Cleanup] Received SIGINT, stopping auto-cleanup...');
  stopAutoCleanup();
});
