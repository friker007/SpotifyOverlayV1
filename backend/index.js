const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
require('dotenv').config();

const app = express();
const PORT = 5000;
const TOKENS_FILE = './tokens.json';

app.use(cors());
app.use(express.json());

// 🔐 Exchange Spotify auth code for access + refresh token
app.post('/api/get-token', async (req, res) => {
  const code = req.body.code;
  const userId = req.body.user_id;

  if (!code || !userId) {
    return res.status(400).json({ error: 'Missing code or user_id' });
  }

  const redirectUri = process.env.REDIRECT_URI;

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
            ).toString('base64')
        }
      }
    );

    const tokens = await fs.readJson(TOKENS_FILE).catch(() => ({}));
    tokens[userId] = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      timestamp: Date.now()
    };

    await fs.writeJson(TOKENS_FILE, tokens, { spaces: 2 });

    console.log(`[✅] Stored token for user: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[❌] Spotify token error:', error.response?.data || error.message);
    res.status(400).json({ error: 'Failed to get token' });
  }
});

// 🔁 Refresh token if expired, or return valid one
app.get('/api/user/:id/token', async (req, res) => {
  const userId = req.params.id;

  try {
    const tokens = await fs.readJson(TOKENS_FILE);
    const userToken = tokens[userId];

    if (!userToken) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = Date.now();
    const expiresIn = userToken.expires_in * 1000; // ms
    const timePassed = now - userToken.timestamp;

    if (timePassed < expiresIn) {
      // ✅ Still valid
      return res.json({ access_token: userToken.access_token });
    }

    // 🔁 Expired — refresh it
    console.log(`[♻️] Refreshing token for user: ${userId}`);

    const refreshResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: userToken.refresh_token
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
            ).toString('base64')
        }
      }
    );

    const newAccessToken = refreshResponse.data.access_token;
    const newExpiresIn = refreshResponse.data.expires_in || userToken.expires_in;

    tokens[userId] = {
      ...userToken,
      access_token: newAccessToken,
      expires_in: newExpiresIn,
      timestamp: Date.now()
    };

    await fs.writeJson(TOKENS_FILE, tokens, { spaces: 2 });

    return res.json({ access_token: newAccessToken });
  } catch (error) {
    console.error('[❌] Refresh failed:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});

app.post('/api/admin/tokens', async (req, res) => {
  const adminPassword = req.body.password;

  if (adminPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const tokens = await fs.readJson(TOKENS_FILE);
    return res.json(tokens);
  } catch (err) {
    return res.status(500).json({ error: 'Could not read tokens' });
  }
});

app.post('/api/admin/refresh', async (req, res) => {
  const { password, user_id } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const tokens = await fs.readJson(TOKENS_FILE);
    const token = tokens[user_id];
    if (!token) return res.status(404).json({ error: 'User not found' });

    const refreshResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
            ).toString('base64'),
        },
      }
    );

    token.access_token = refreshResponse.data.access_token;
    token.expires_in = refreshResponse.data.expires_in || token.expires_in;
    token.timestamp = Date.now();
    await fs.writeJson(TOKENS_FILE, tokens, { spaces: 2 });

    return res.json({ access_token: token.access_token });
  } catch (error) {
    return res.status(500).json({ error: 'Refresh failed' });
  }
});

app.post('/api/admin/remove', async (req, res) => {
  const { password, user_id } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const tokens = await fs.readJson(TOKENS_FILE);
    if (!tokens[user_id]) return res.status(404).json({ error: 'User not found' });

    delete tokens[user_id];
    await fs.writeJson(TOKENS_FILE, tokens, { spaces: 2 });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});
