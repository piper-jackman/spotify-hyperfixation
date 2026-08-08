# Spotify Hyperfixation Mode - Server Setup (Final Working Solution)

## The Problem Fixed

Spotify now requires the Authorization Code Flow instead of the Implicit Flow. This means we need a simple backend server to securely exchange the authorization code for an access token.

The good news: **No npm build issues!** This is a simple Node.js server - no React build process.

## Step-by-Step Setup

### Step 1: Create Spotify App & Get Credentials

1. Go to: https://developer.spotify.com/dashboard
2. Click **"Create an App"**
3. Fill in:
   - Name: `Hyperfixation Mode`
   - Description: `Music hyperfixation tool`
   - Accept terms
4. Click **"Create"**
5. On your app page, copy:
   - **Client ID**
   - **Client Secret** (click "Show Client Secret")

### Step 2: Add Redirect URI to Spotify

1. Still on your app page, click **"Edit Settings"**
2. Scroll to **"Redirect URIs"**
3. Add this: `http://localhost:8000/callback`
4. Click **"Save"**

### Step 3: Create Folder and Files

1. Create a new folder: `hyperfixation-app`
2. Put these files in it:
   - `server.js` (I'll create this)
   - `index.html` (I'll create this)

### Step 4: Update server.js

Open `server.js` and find these lines at the top:

```javascript
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_SPOTIFY_CLIENT_SECRET';
```

Replace them with your actual values from Spotify:

```javascript
const CLIENT_ID = 'a1b2c3d4e5f6...'; // Your Client ID
const CLIENT_SECRET = 'xyz789abc123...'; // Your Client Secret
```

### Step 5: Install Node.js (If You Don't Have It)

Download from: https://nodejs.org/

### Step 6: Start the Server

1. Open terminal/command prompt
2. Navigate to your `hyperfixation-app` folder
3. Run:

```bash
node server.js
```

You should see:

```
🎵 Spotify Hyperfixation Mode Server
=====================================

✅ Server running at http://localhost:8000

🌐 Open in browser: http://localhost:8000
```

### Step 7: Use the App!

1. Open browser
2. Go to: `http://localhost:8000`
3. Click **"Connect with Spotify"**
4. Authorize
5. Add songs and start using!

---

## How It Works

1. **User clicks "Connect"** → Goes to `/login`
2. **Server redirects** to Spotify's authorization page
3. **User authorizes** → Spotify redirects to `/callback` with a code
4. **Server exchanges code** for access token (using Client Secret)
5. **Server redirects back** to app with token
6. **App uses token** to access Spotify API

This is the secure way - the Client Secret never touches the browser!

---

## Troubleshooting

### "Cannot find module 'http'" or similar
- Make sure you're using Node.js, not just npm
- Run `node --version` to verify

### "EADDRINUSE: address already in use"
- Another app is using port 8000
- Change the PORT in server.js to something else (like 8001)

### "Authorization error" on Spotify login
- Double-check your Client ID and Client Secret
- Make sure redirect URI is exactly: `http://localhost:8000/callback`

### "Cannot GET /" 
- Make sure `index.html` is in the same folder as `server.js`

### Still getting "response_type must be code"
- This was the old error from the HTML-only version
- The new server.js fix should resolve this

---

## Permanent Setup (For When You Want to Keep It Running)

If you want to deploy this permanently:

### Option 1: Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Follow prompts, then update your Spotify redirect URI to the Vercel URL.

### Option 2: Heroku

Deploy using Heroku's free tier and update the redirect URI.

### Option 3: Run on Always-On Computer

Keep your computer running the server 24/7 on port 8000.

---

## Files Included

- `server.js` - Node.js server that handles OAuth
- `index.html` - React app (loads from CDN, no build needed)

That's it! Two files, one server.

---

## Quick Checklist

- [ ] Created Spotify app and got Client ID + Secret
- [ ] Added `http://localhost:8000/callback` to Spotify redirect URIs
- [ ] Edited `server.js` with your credentials
- [ ] Have Node.js installed
- [ ] Run `node server.js`
- [ ] Open `http://localhost:8000`
- [ ] Click "Connect with Spotify"
- [ ] Enjoy! 🎵

---

Let me know if you hit any issues!
