# Endpoint Team - API Key Update Required

## ⚠️ IMPORTANT: API Key Has Changed

The API key was rotated for security reasons. **The old key no longer works.**

## What You Need to Do

### Update Your `.env` File

Contact the server team lead to get the new API key, then update your `.env` file on the Raspberry Pi:

```bash
API_KEY=<new_key_provided_by_server_team>
```

### Complete Example `.env` File

```bash
# Endpoint identification
ENDPOINT_ID=EP1

# WiFi interface for monitoring
WLAN_IFACE=wlan1

# Server connection
SERVER_URL=http://your-server-ip:3000/api/endpoint/scan-data

# Authentication - GET NEW KEY FROM SERVER TEAM
API_KEY=<your_new_api_key_here>

# Optional settings
LOG_LEVEL=INFO
HEARTBEAT_SEC=30
BATCH_MAX=200
BATCH_INTERVAL=5
```

## Testing

After updating, test your endpoint:

```bash
python3 endpoint/stream.py
```

You should see successful POST requests to the server. If you get authentication errors, double-check the API key.

## Questions?

Contact the server team if you have issues.
