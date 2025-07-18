import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

const {
  DISCORD_TOKEN,
  CHANNEL_ID,
  MESSAGE_ID,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_ACCESS_TOKEN: initialAccessToken,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

if (!DISCORD_TOKEN || !CHANNEL_ID || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error("One or more environment variables are missing.");
  process.exit(1);
}

let accessToken = initialAccessToken || '';
let storedMessageId = MESSAGE_ID || null;
let updateIntervalMs = 10000; // Start with 10 seconds
let updateTimeout;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function refreshSpotifyToken() {
  console.log('Refreshing Spotify access token...');
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', SPOTIFY_REFRESH_TOKEN);
  params.append('client_id', SPOTIFY_CLIENT_ID);
  params.append('client_secret', SPOTIFY_CLIENT_SECRET);

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to refresh Spotify token: ${error}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  console.log('Spotify access token refreshed');
}

async function fetchSpotifyData() {
  if (!accessToken) {
    await refreshSpotifyToken();
  }

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 204) {
    // No content - nothing playing
    return null;
  }

  if (res.status === 401) {
    // Token expired
    await refreshSpotifyToken();
    return fetchSpotifyData(); // Retry
  }

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data;
}

function msToTimestamp(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function buildEmbed(data) {
  if (!data) {
    return new EmbedBuilder()
      .setColor('Black')
      .setTitle('jack is not listening to anything right now');
  }

  const song = data.item.name;
  const artists = data.item.artists.map(a => a.name).join(', ');
  const albumArt = data.item.album.images[0]?.url || null;

  const progressMs = data.progress_ms;
  const durationMs = data.item.duration_ms;

  const startTimestamp = Math.floor((Date.now() - progressMs) / 1000);
  const endTimestamp = Math.floor((Date.now() + (durationMs - progressMs)) / 1000);

  return new EmbedBuilder()
    .setColor('Black')
    .setTitle('jack is currently listening to')
    .setDescription(`**${song}** by **${artists}**`)
    .setImage(albumArt)
    .addFields(
      { name: 'Started', value: `<t:${startTimestamp}:T>`, inline: true },
      { name: 'Ends', value: `<t:${endTimestamp}:T>`, inline: true },
      { name: 'Progress', value: `${msToTimestamp(progressMs)} / ${msToTimestamp(durationMs)}`, inline: true },
    );
}

async function updateSpotifyMessage() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) throw new Error('Channel not found');

    const data = await fetchSpotifyData();

    const embed = buildEmbed(data);

    if (storedMessageId) {
      // Edit existing message
      const msg = await channel.messages.fetch(storedMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
      } else {
        const newMsg = await channel.send({ embeds: [embed] });
        storedMessageId = newMsg.id;
        console.log('Stored new message ID:', storedMessageId);
      }
    } else {
      // Send new message and store ID
      const newMsg = await channel.send({ embeds: [embed] });
      storedMessageId = newMsg.id;
      console.log('Stored message ID:', storedMessageId);
    }
  } catch (err) {
    console.error('Error updating Spotify message:', err);
  } finally {
    // Dynamic interval based on whether user is playing something or not
    updateTimeout = setTimeout(updateSpotifyMessage, updateIntervalMs);
  }
}

// Slash commands
const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Show bot status and current settings'),
  new SlashCommandBuilder().setName('refresh').setDescription('Manually refresh Spotify data'),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await registerCommands();

  updateSpotifyMessage();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await interaction.reply({ content: `Bot is online. Updating every ${updateIntervalMs / 1000} seconds.`, ephemeral: true });
  } else if (interaction.commandName === 'refresh') {
    await interaction.deferReply({ ephemeral: true });
    try {
      await updateSpotifyMessage();
      await interaction.editReply('Spotify data refreshed!');
    } catch {
      await interaction.editReply('Failed to refresh Spotify data.');
    }
  }
});

client.login(DISCORD_TOKEN);
