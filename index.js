import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import express from "express";
import fetch from "node-fetch";

const {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  CHANNEL_ID,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  OWNER_ID
} = process.env;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// =====================
// Slash Command Setup
// =====================
const commands = [
  new SlashCommandBuilder()
    .setName("getrefreshtoken")
    .setDescription("Authorize Spotify and get a new refresh token"),
];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
    console.log("Slash commands registered");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
})();

// =====================
// Spotify OAuth Flow
// =====================
const app = express();
const PORT = process.env.PORT || 8080;

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (data.refresh_token) {
      // Find your user on Discord and DM the refresh token
      const owner = await client.users.fetch(OWNER_ID);
      await owner.send(`🎉 **Your new Spotify refresh token:**\n\`${data.refresh_token}\``);
      res.send("Refresh token sent to your Discord DM! You can close this page.");
    } else {
      res.send(`Error getting token: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    res.status(500).send("Failed to exchange code");
  }
});

app.listen(PORT, () => {
  console.log(`OAuth server listening on port ${PORT}`);
});

// =====================
// Discord Bot Handling
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "getrefreshtoken") {
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
      return;
    }

    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: "user-read-currently-playing user-read-playback-state user-read-email",
    }).toString()}`;

    await interaction.reply({
      content: `Click this link to authorize Spotify:\n${authUrl}`,
      ephemeral: true,
    });
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);
