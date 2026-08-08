const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION - Use environment variables
// ============================================================================
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '71eece51cc7749cc8e30a00382606ed7';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '2d60666611dd4e93848566be6afbd942';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://asks-layers-oval-shadow.trycloudflare.com/callback';

// ============================================================================
// SERVER
// ============================================================================

const PORT = process.env.PORT || 8000;

const server = http.createServer(async (req, res) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  console.log(`Pathname: ${pathname}`);
  console.log('Query:', query);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Root path - serve HTML
    if (pathname === '/' || pathname === '/index.html') {
      console.log('Serving HTML...');
      const htmlPath = path.join(__dirname, 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    // Serve manifest.json
    if (pathname === '/manifest.json') {
      const manifestPath = path.join(__dirname, 'manifest.json');
      const manifest = fs.readFileSync(manifestPath, 'utf8');
      
      res.writeHead(200, { 'Content-Type': 'application/manifest+json' });
      res.end(manifest);
      return;
    }

    // Login endpoint - redirect to Spotify
    if (pathname === '/login') {
      console.log('Login request - redirecting to Spotify...');
      const scopes = [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-modify-playback-state'
      ];

      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('client_id', CLIENT_ID);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('scope', scopes.join(' '));
      authUrl.searchParams.append('show_dialog', 'true');

      console.log('Auth URL:', authUrl.toString());
      res.writeHead(302, { 'Location': authUrl.toString() });
      res.end();
      return;
    }

    // Callback endpoint - exchange code for token
    if (pathname === '/callback') {
      console.log('=== CALLBACK RECEIVED ===');
      const code = query.code;
      const error = query.error;

      console.log('Error:', error);
      console.log('Code:', code ? code.substring(0, 20) + '...' : 'NONE');

      if (error) {
        console.log('Spotify returned error:', error);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization Error</h1><p>${error}</p>`);
        return;
      }

      if (!code) {
        console.log('No authorization code provided');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Missing authorization code</h1>');
        return;
      }

      // Exchange code for token
      try {
        console.log('Exchanging code for token...');
        const token = await exchangeCodeForToken(code);
        console.log('✅ Token received:', token.substring(0, 20) + '...');
        
        // Redirect back to app with token
        const redirectUrl = `/#access_token=${token}&token_type=Bearer`;
        console.log('Redirecting to:', redirectUrl);
        res.writeHead(302, {
          'Location': redirectUrl
        });
        res.end();
      } catch (err) {
        console.error('❌ Token exchange failed:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Token Exchange Error</h1><p>${err.message}</p>`);
      }
      return;
    }

    // 404
    console.log('404 - Path not found');
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 Not Found</h1>');

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Server Error</h1><p>${error.message}</p>`);
  }
});

// ============================================================================
// HELPER: Exchange authorization code for access token
// ============================================================================
function exchangeCodeForToken(code) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    console.log('Spotify token request:');
    console.log('  grant_type: authorization_code');
    console.log('  code:', code.substring(0, 20) + '...');
    console.log('  redirect_uri:', REDIRECT_URI);
    console.log('  client_id:', CLIENT_ID.substring(0, 20) + '...');
    console.log('  client_secret: [hidden]');

    const options = {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      console.log('Spotify response status:', res.statusCode);
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Spotify response body:', data);
        try {
          const json = JSON.parse(data);
          if (json.error) {
            console.error('Spotify error response:', json);
            reject(new Error(json.error_description || json.error));
          } else {
            console.log('✅ Successfully got access token');
            resolve(json.access_token);
          }
        } catch (err) {
          console.error('Failed to parse response:', err);
          reject(new Error('Failed to parse token response'));
        }
      });
    });

    req.on('error', (err) => {
      console.error('HTTPS request error:', err);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// ============================================================================
// START SERVER
// ============================================================================
server.listen(PORT, () => {
  console.log(`\n🎵 Spotify Hyperfixation Mode Server`);
  console.log(`=====================================`);
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log(`\n🌐 Access via Cloudflare: ${REDIRECT_URI.replace('/callback', '')}\n`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
