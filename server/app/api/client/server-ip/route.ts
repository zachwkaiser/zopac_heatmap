import { NextResponse } from 'next/server';

// Simple endpoint for client team to test server connectivity
// No API key required - this is for authenticated web users
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serverIP } = body;

    if (!serverIP) {
      return NextResponse.json(
        { error: 'serverIP is required' },
        { status: 400 }
      );
    }

    // For now, just echo back the server IP
    // Later this could save preferences, validate IP format, etc.
    return NextResponse.json({
      success: true,
      message: 'Server IP received successfully',
      data: {
        serverIP: serverIP,
        receivedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Server IP endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Invalid request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 400 }
    );
  }
}

// GET endpoint to retrieve current server configuration
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
}
