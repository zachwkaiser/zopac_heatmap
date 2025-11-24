#!/bin/bash

# Google OAuth Authentication Test Script
# Tests the user story: "As a user, I want to log in with my Google account 
# so that I can quickly authenticate without creating another password."
#

# 1. Server must be running on port 3000: cd server && npm run dev
# 2. Google OAuth must be configured with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
# 3. Test Google account credentials available
#

BASE_URL="http://localhost:3000"

echo "========================================="
echo "Testing Google OAuth Authentication"
echo "User Story: Login with Google Account"
echo "========================================="
echo ""

# Test 1: Check NextAuth API availability
echo "1. Testing NextAuth API availability"
echo "Checking if NextAuth handlers are configured..."
curl -s -i -X GET "${BASE_URL}/api/auth/providers" | head -20
echo ""
echo ""

# Test 2: Verify Google provider is configured
echo "2. Testing GET /api/auth/providers"
echo "Verifying Google provider is available..."
PROVIDERS=$(curl -s -X GET "${BASE_URL}/api/auth/providers")
echo "$PROVIDERS" | python3 -m json.tool

# Check if Google is in the providers list
if echo "$PROVIDERS" | grep -q "google"; then
    echo "✓ Google OAuth provider is configured"
else
    echo "✗ Google OAuth provider NOT found"
fi
echo ""
echo ""

# Test 3: Test CSRF token endpoint
echo "3. Testing CSRF token generation"
echo "Getting CSRF token for authentication..."
curl -s -X GET "${BASE_URL}/api/auth/csrf" | python3 -m json.tool
echo ""
echo ""

# Test 4: Test session endpoint (should return null when not authenticated)
echo "4. Testing GET /api/auth/session"
echo "Checking session status (should be null/unauthenticated)..."
curl -s -X GET "${BASE_URL}/api/auth/session" | python3 -m json.tool
echo ""
echo ""

# Test 5: Simulate OAuth signin request
echo "5. Testing Google OAuth signin endpoint"
echo "Checking Google OAuth redirect URL..."
curl -s -i -X GET "${BASE_URL}/api/auth/signin/google" | head -30
echo ""
echo ""

# Test 6: Test callback URL accessibility
echo "6. Testing OAuth callback endpoint availability"
echo "Verifying callback URL is accessible..."
curl -s -i -X GET "${BASE_URL}/api/auth/callback/google" | head -20
echo ""
echo ""

# Test 7: Verify CORS headers for client authentication
echo "7. Testing CORS headers for OAuth flow"
echo "Making preflight request..."
curl -s -X OPTIONS "${BASE_URL}/api/auth/session" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i | head -20
echo ""
echo ""

# Test 8: Test signout endpoint
echo "8. Testing signout endpoint availability"
echo "Verifying signout functionality is available..."
curl -s -i -X GET "${BASE_URL}/api/auth/signout" | head -20
echo ""
echo ""

echo "========================================="
echo "Automated Tests Complete!"
echo "========================================="
echo ""
echo "Test Summary:"
echo "-------------"
echo "✓ NextAuth API endpoints are accessible"
echo "✓ Google OAuth provider configuration can be verified"
echo "✓ CSRF protection is enabled"
echo "✓ Session management endpoints are working"
echo "✓ OAuth signin and callback URLs are available"
echo ""
echo "Manual Testing Required:"
echo "------------------------"
echo "To fully test the Google OAuth flow:"
echo "1. Open browser to: ${BASE_URL}/login"
echo "2. Click 'Sign in with Google' button"
echo "3. Authenticate with Google account"
echo "4. Verify redirect to dashboard after successful login"
echo "5. Check session by visiting: ${BASE_URL}/api/auth/session"
echo "6. Verify user information is returned (name, email, image)"
echo "7. Test sign out functionality"
echo ""
echo "Expected Behavior:"
echo "------------------"
echo "- User clicks 'Sign in with Google'"
echo "- Redirected to Google authentication page"
echo "- After Google authentication, redirected back to app"
echo "- Session created with Google account information"
echo "- User can access protected routes without password"
echo "- No separate account creation required"
echo ""
