import express from "express";
import fetch from "node-fetch";
import { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST } from "discord.js";

const app = express();
const PORT = process.env.PORT || 8080;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const USER_ID = "1119452485891928096"; // your Discord ID

// Slash command registration
const commands = [
  new SlashCommandBuilder()
    .setName("getrefreshtoken")
    .setDescription("Generate a new Spotify refresh token (only for the bot owner)")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "getrefreshtoken") {
    if (interaction.user.id !== USER_ID) {
      await interaction.reply({ content: "You don’t have permission to use this command.", ephemeral: true });
      return;
    }

    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=user-read-playback-state%20user-read-currently-playing%20user-read-email%20user-read-private%20user-library-read%20user-read-recently-played%20playlist-read-private%20playlist-read-collaborative%20user-modify-playback-state&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;

    await interaction.reply({
      content: `Click [here](${authUrl}) to authorize and get your refresh token.`,
      ephemeral: true
    });
  }
});

// Express route for Spotify callback
app.get("/callback", async (req, res) => {
  const code = req.query.code || null;

  const tokenUrl = "https://accounts.spotify.com/api/token";
  const body = new URLSearchParams({
    code: code,
    redirect_uri: process.env.REDIRECT_URI,
    grant_type: "authorization_code"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET).toString("base64")
    },
    body
  });

  const data = await response.json();

  if (data.refresh_token) {
    res.send(`Your refresh token: ${data.refresh_token}`);
  } else {
    res.send("Failed to get refresh token: " + JSON.stringify(data));
  }
});

// Start both bot and server
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});
client.login(DISCORD_TOKEN);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
