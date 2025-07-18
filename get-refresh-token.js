import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();

const PORT = process.env.PORT || 8080;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

function generateRandomString(length) {
  return crypto.randomBytes(length).toString("hex");
}

app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  const scope = "user-read-private user-read-email";

  const authQueryParameters = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${authQueryParameters.toString()}`);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;

  if (!code) {
    return res.send("No code received");
  }

  try {
    const authOptions = {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    };

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", authOptions);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.send(`Error getting tokens: ${JSON.stringify(tokenData)}`);
    }

    const refreshToken = tokenData.refresh_token;

    console.log("Your Spotify refresh token:", refreshToken);

    res.send(`
      <h2>Spotify Refresh Token</h2>
      <p>Copy this refresh token and save it securely (add to your environment variables):</p>
      <textarea cols="80" rows="5" readonly>${refreshToken}</textarea>
      <p>You can close this window now.</p>
    `);
  } catch (error) {
    res.send(`Error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Spotify OAuth server running on port ${PORT}`);
  console.log(`Go to /login to start authorization`);
});
