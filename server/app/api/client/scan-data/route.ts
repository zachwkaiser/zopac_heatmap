import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

/**
 * Secure proxy route for client-side access to scan data
 * This route uses the API key server-side and forwards the request to the endpoint route
 * The API key never leaves the server - it's never exposed to the client
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters from the client request
    const { searchParams } = new URL(request.url);
    const endpoint_id = searchParams.get('endpoint_id');
    const limit = searchParams.get('limit') || '100';

    // Build the internal endpoint URL
    const endpointUrl = new URL('/api/endpoint/scan-data', request.url);
    if (endpoint_id) endpointUrl.searchParams.set('endpoint_id', endpoint_id);
    endpointUrl.searchParams.set('limit', limit);

    // Get the API key from environment variables (server-side only)
    const apiKey = process.env.ENDPOINT_API_KEY || process.env.API_KEY || process.env.AUTH_SECRET;

    if (!apiKey) {
      console.error('API key not found in environment variables');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Server configuration error' 
        },
        { status: 500 }
      );
    }

    // Make internal request to the endpoint route with the API key
    const response = await fetch(endpointUrl.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Forward the response to the client
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy route error:', error);
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

