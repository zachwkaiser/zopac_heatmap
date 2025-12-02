// Next.js instrumentation hook - runs on server startup
// This is automatically called by Next.js when the server starts

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Server] Initializing background tasks...');
    
    // Import and start auto-cleanup
    const { startAutoCleanup } = await import('./app/lib/auto-cleanup');
    startAutoCleanup();
    
    console.log('[Server] Background tasks initialized');
  }
}
