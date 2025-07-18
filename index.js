import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DISCORD_USER_ID = "your-discord-user-id"; // Replace with your actual Discord user ID

// Register slash commands on startup
const commands = [
  new SlashCommandBuilder()
    .setName("gettoken")
    .setDescription("Get a private Spotify auth link to generate a refresh token")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.Discord_token);

async function registerCommands() {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(
      Routes.applicationCommands(process.env.Discord_client_id),
      { body: commands }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  registerCommands();
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "gettoken") {
    if (interaction.user.id !== DISCORD_USER_ID) {
      return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    }

    const authUrl = `${process.env.RAILWAY_PUBLIC_URL}/login`;

    await interaction.reply({
      content: `Click [here](${authUrl}) to authorize your Spotify account and get a refresh token. This link is private to you.`,
      ephemeral: true,
    });
  }
});

client.login(process.env.Discord_token);
