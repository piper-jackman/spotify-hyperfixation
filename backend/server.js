require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage (in production, use a real database like PostgreSQL)
const cache = new NodeCache({ stdTTL: 3600 });
const activeMonitoring = new Map(); // userId -> monitoring state

// Store user data with format: { userId: { accessToken, refreshToken, hyperfixationTracks, currentTrackIdWeQueuedFor } }
const users = new Map();

// ============================================================================
// SPOTIFY API SERVICE
// ============================================================================

class SpotifyService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseURL = 'https://api.spotify.com/v1';
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Token expired');
      }
      throw error;
    }
  }

  async getCurrentlyPlaying() {
    try {
      return await this.makeRequest('/me/player/currently-playing');
    } catch (error) {
      console.error('Error getting currently playing:', error.message);
      return null;
    }
  }

  async queueTrack(trackURI) {
    try {
      await this.makeRequest(`/me/player/queue?uri=${trackURI}`, 'POST');
      return true;
    } catch (error) {
      console.error('Error queueing track:', error.message);
      return false;
    }
  }
}

// ============================================================================
// HYPERFIXATION MONITORING SERVICE
// ============================================================================

class HyperfixationMonitor {
  constructor(userId, accessToken, hyperfixationTracks) {
    this.userId = userId;
    this.spotifyService = new SpotifyService(accessToken);
    this.hyperfixationTracks = hyperfixationTracks;
    this.currentTrackIdWeQueuedFor = null;
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log(`Starting hyperfixation monitoring for user ${this.userId}`);
    
    // Poll every 3 seconds
    this.monitoringInterval = setInterval(() => {
      this.monitor();
    }, 3000);

    // Also run immediately
    this.monitor();
  }

  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log(`Stopped hyperfixation monitoring for user ${this.userId}`);
  }

  async monitor() {
    try {
      const currentlyPlaying = await this.spotifyService.getCurrentlyPlaying();

      if (!currentlyPlaying || !currentlyPlaying.item || !currentlyPlaying.is_playing) {
        return;
      }

      const currentTrack = currentlyPlaying.item;
      await this.handleTrackChange(currentTrack);
    } catch (error) {
      console.error(`Monitor error for user ${this.userId}:`, error.message);
      if (error.message === 'Token expired') {
        this.stop();
      }
    }
  }

  async handleTrackChange(track) {
    const isHyperfixationTrack = this.hyperfixationTracks.some(t => t.id === track.id);

    // Check 1: Is this the same regular track we already queued for?
    if (this.currentTrackIdWeQueuedFor === track.id) {
      console.log(`[${this.userId}] Already queued for ${track.name}`);
      return;
    }

    // Check 2: Is this a hyperfixation track?
    if (isHyperfixationTrack) {
      console.log(`[${this.userId}] Playing hyperfixation: ${track.name}`);
      return;
    }

    // Check 3: Queue a hyperfixation song for this regular track
    if (this.hyperfixationTracks.length > 0) {
      const randomTrack = this.hyperfixationTracks[
        Math.floor(Math.random() * this.hyperfixationTracks.length)
      ];

      const success = await this.spotifyService.queueTrack(randomTrack.uri);
      if (success) {
        this.currentTrackIdWeQueuedFor = track.id;
        console.log(`[${this.userId}] Queued: ${randomTrack.name}`);
      }
    }
  }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeUsers: users.size, monitoring: activeMonitoring.size });
});

// Start monitoring
app.post('/api/monitoring/start', (req, res) => {
  try {
    const { userId, accessToken, hyperfixationTracks } = req.body;

    if (!userId || !accessToken || !hyperfixationTracks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store user data
    users.set(userId, {
      accessToken,
      hyperfixationTracks,
      createdAt: new Date()
    });

    // Start monitoring if not already running
    if (!activeMonitoring.has(userId)) {
      const monitor = new HyperfixationMonitor(userId, accessToken, hyperfixationTracks);
      monitor.start();
      activeMonitoring.set(userId, monitor);
    }

    res.json({
      success: true,
      message: 'Monitoring started',
      userId
    });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop monitoring
app.post('/api/monitoring/stop', (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const monitor = activeMonitoring.get(userId);
    if (monitor) {
      monitor.stop();
      activeMonitoring.delete(userId);
      users.delete(userId);
    }

    res.json({
      success: true,
      message: 'Monitoring stopped'
    });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update hyperfixation tracks
app.post('/api/monitoring/tracks', (req, res) => {
  try {
    const { userId, hyperfixationTracks } = req.body;

    if (!userId || !hyperfixationTracks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const monitor = activeMonitoring.get(userId);
    if (monitor) {
      monitor.hyperfixationTracks = hyperfixationTracks;
    }

    res.json({
      success: true,
      message: 'Tracks updated'
    });
  } catch (error) {
    console.error('Error updating tracks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get monitoring status
app.get('/api/monitoring/status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const monitor = activeMonitoring.get(userId);
    const user = users.get(userId);

    if (!monitor || !user) {
      return res.json({
        isMonitoring: false,
        hyperfixationTracks: []
      });
    }

    res.json({
      isMonitoring: monitor.isMonitoring,
      hyperfixationTracks: monitor.hyperfixationTracks,
      currentTrackIdWeQueuedFor: monitor.currentTrackIdWeQueuedFor
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n🎵 Spotify Hyperfixation Backend`);
  console.log(`=====================================`);
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  activeMonitoring.forEach((monitor) => monitor.stop());
  process.exit(0);
});
