import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// API key validation for endpoint routes
function validateApiKey(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const validKey = process.env.ENDPOINT_API_KEY;
  
  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or missing API key' },
      { status: 401 }
    );
  }
  
  return null; // Valid API key
}

const authMiddleware = NextAuth(authConfig).auth;

export default function middleware(request: NextRequest) {
  // Check if this is an endpoint API route
  if (request.nextUrl.pathname.startsWith('/api/endpoint')) {
    const apiKeyError = validateApiKey(request);
    if (apiKeyError) {
      return apiKeyError;
    }
    return NextResponse.next();
  }
  
  // For all other routes, use NextAuth middleware
  return authMiddleware(request as any);
}
 
export const config = {
  // Apply middleware to endpoint API routes and protected pages
  matcher: [
    '/api/endpoint/:path*',
    '/((?!api|_next/static|_next/image|.*\\.png$).*)'
  ],
};
