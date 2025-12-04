// Next.js instrumentation hook - runs on server startup
// This is automatically called by Next.js when the server starts

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Server] Initializing...');
    
    // Auto-cleanup disabled to prevent OOM on 256MB database
    // Use POST /api/admin/cleanup endpoint to manually clean old data
    
    console.log('[Server] Initialized (auto-cleanup disabled)');
  }
}
