import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  REDIRECT_URI
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !REDIRECT_URI) {
  console.error("Missing environment variables. Make sure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and REDIRECT_URI are set.");
  process.exit(1);
}

// Step 1: Provide authorization URL
app.get('/', (req, res) => {
  const scope = 'user-read-currently-playing user-read-playback-state';
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;
  res.send(`<a href="${authUrl}">Click here to authorize Spotify</a>`);
});

// Step 2: Handle callback and exchange code for tokens
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code received from Spotify");

  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('client_id', SPOTIFY_CLIENT_ID);
  params.append('client_secret', SPOTIFY_CLIENT_SECRET);

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    if (data.error) {
      return res.send(`Error: ${data.error_description || data.error}`);
    }

    res.send(`
      <h1>Refresh Token Retrieved!</h1>
      <p><strong>Refresh Token:</strong> ${data.refresh_token}</p>
      <p>Save this refresh token in your .env as <code>SPOTIFY_REFRESH_TOKEN</code>.</p>
    `);
  } catch (err) {
    console.error(err);
    res.send("Error retrieving token");
  }
});

app.listen(port, () => {
  console.log(`OAuth server running on port ${port}`);
});
