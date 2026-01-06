# Nginx Configuration for Audio Streaming

This document provides an example Nginx configuration for serving audio files with access control.

## Overview

The audio system supports two types of content:
- **Free audio**: Served directly from `/media/free/` directory
- **Premium audio**: Served via Node.js access control using `X-Accel-Redirect`

## Directory Structure

```
/var/www/reader-bot/
├── media/
│   ├── free/              # Public free audio files
│   │   └── intro-psychology-reading.mp3
│   └── protected/         # Protected premium audio files (not directly accessible)
│       └── premium-1.mp3
```

## Nginx Configuration Example

```nginx
# Main server block
server {
    listen 80;
    server_name your-domain.com;

    # Node.js application proxy
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Public free audio files - served directly by Nginx
    location /media/free/ {
        alias /var/www/reader-bot/media/free/;
        
        # CORS headers for audio playback
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Range';
        
        # Enable range requests for audio seeking
        add_header 'Accept-Ranges' 'bytes';
        
        # Cache headers
        expires 7d;
        add_header Cache-Control "public, immutable";
        
        # Audio mime types
        types {
            audio/mpeg mp3;
            audio/ogg ogg;
            audio/wav wav;
            audio/aac aac;
        }
        
        # Only allow GET and HEAD methods
        limit_except GET HEAD {
            deny all;
        }
    }

    # Protected stream endpoint - proxied to Node.js for access check
    location /media/stream/ {
        # Proxy to Node.js application
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Important: Don't buffer the response to support streaming
        proxy_buffering off;
    }

    # Internal location for X-Accel-Redirect
    # This is used by Node.js to serve protected files after access check
    location /media-protected/ {
        internal;  # Only accessible via X-Accel-Redirect
        alias /var/www/reader-bot/media/protected/;
        
        # CORS headers for audio playback
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Range';
        
        # Enable range requests for audio seeking
        add_header 'Accept-Ranges' 'bytes';
        
        # Audio mime types
        types {
            audio/mpeg mp3;
            audio/ogg ogg;
            audio/wav wav;
            audio/aac aac;
        }
    }

    # Static files for Mini App
    location /mini-app/ {
        alias /var/www/reader-bot/mini-app/;
        try_files $uri $uri/ =404;
    }
}
```

## How It Works

### Free Audio Flow

1. Client requests: `GET /media/free/intro-psychology-reading.mp3`
2. Nginx serves the file directly from `/var/www/reader-bot/media/free/`
3. No access control check needed

### Premium Audio Flow

1. Client requests stream URL from API: `GET /api/audio/premium-1/stream-url?userId=123`
2. Node.js checks user's access rights via `entitlementService`
3. If authorized, returns: `{ "url": "/media/stream/premium-1" }`
4. Client requests: `GET /media/stream/premium-1?userId=123`
5. Request goes to Node.js (proxied by Nginx)
6. Node.js verifies access again
7. If authorized, Node.js responds with:
   - Header: `X-Accel-Redirect: /media-protected/premium-1.mp3`
   - Header: `Content-Type: audio/mpeg`
8. Nginx intercepts the response, serves the file from protected directory
9. File is streamed to client

## Security Considerations

### Access Control

- Premium audio files are stored in `/media/protected/` which is marked as `internal` in Nginx
- Direct requests to `/media-protected/` are blocked (403 Forbidden)
- Access is only granted via `X-Accel-Redirect` from Node.js after authentication check

### Authentication

Current implementation uses `userId` query parameter for simplicity. **For production, implement proper authentication:**

```javascript
// Example: JWT authentication middleware
const { verifyToken } = require('../middleware/auth');

router.get('/:id/stream-url', verifyToken, async (req, res) => {
  const userId = req.user.id; // From verified JWT token
  // ... rest of the code
});
```

### CORS

The configuration allows CORS for audio playback. Adjust as needed:

```nginx
# Restrict to specific domains in production
add_header 'Access-Control-Allow-Origin' 'https://your-domain.com';
```

## File Permissions

Ensure proper file permissions on the server:

```bash
# Free audio directory
sudo chown -R www-data:www-data /var/www/reader-bot/media/free/
sudo chmod -R 755 /var/www/reader-bot/media/free/

# Protected audio directory
sudo chown -R www-data:www-data /var/www/reader-bot/media/protected/
sudo chmod -R 755 /var/www/reader-bot/media/protected/
```

## Testing

### Test Free Audio

```bash
# Should work - returns audio file
curl -I http://your-domain.com/media/free/intro-psychology-reading.mp3
```

### Test Protected Audio (Direct Access)

```bash
# Should fail with 404 or 403
curl -I http://your-domain.com/media-protected/premium-1.mp3
```

### Test Protected Audio (Via API)

```bash
# Get stream URL (requires valid userId)
curl "http://your-domain.com/api/audio/premium-1/stream-url?userId=USER_ID"

# Use returned URL
curl -I "http://your-domain.com/media/stream/premium-1?userId=USER_ID"
```

## Performance Tuning

For better performance with large audio files:

```nginx
# Increase buffer sizes
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;

# Enable sendfile for static files
sendfile on;
tcp_nopush on;
tcp_nodelay on;
```

## Monitoring

Log protected stream access for monitoring:

```nginx
# Custom log format
log_format audio_access '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'userid=$arg_userId';

# Apply to protected stream location
location /media/stream/ {
    access_log /var/log/nginx/audio_access.log audio_access;
    # ... rest of config
}
```
