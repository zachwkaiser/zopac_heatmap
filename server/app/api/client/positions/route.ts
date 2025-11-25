import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

/**
 * Secure proxy route for client-side access to endpoint positions
 * This route uses the API key server-side and forwards the request to the endpoint route
 * The API key never leaves the server - it's never exposed to the client
 */

// GET /api/client/positions - Fetch endpoint positions
export async function GET(request: NextRequest) {
  try {
    // Build the internal endpoint URL
    const endpointUrl = new URL('/api/endpoint/positions', request.url);

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
    console.error('Error fetching endpoint positions via proxy:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch endpoint positions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/client/positions - Update endpoint position
export async function PUT(request: NextRequest) {
  try {
    // Get the request body from the client
    const body = await request.json();

    // Build the internal endpoint URL
    const endpointUrl = new URL('/api/endpoint/positions', request.url);

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
      method: 'PUT',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Forward the response to the client
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating endpoint position via proxy:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update endpoint position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/client/positions - Create/batch update endpoint positions
export async function POST(request: NextRequest) {
  try {
    // Get the request body from the client
    const body = await request.json();

    // Build the internal endpoint URL
    const endpointUrl = new URL('/api/endpoint/positions', request.url);

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
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Forward the response to the client
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating endpoint positions via proxy:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create endpoint positions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
