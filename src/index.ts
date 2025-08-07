import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

// Define command interface
interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
}

// Create commands collection
const commands = new Collection<string, Command>();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => 
  (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.log(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

// Client ready event
client.once('ready', async () => {
  console.log(`🤖 Bot is ready! Logged in as ${client.user?.tag}`);
  
  // Register slash commands
  await registerCommands();
});

// Interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Error executing command:', error);
    
    const errorMessage = 'There was an error while executing this command!';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Register slash commands
async function registerCommands() {
  const commandsData = [];
  
  for (const [name, command] of commands) {
    commandsData.push((command as any).data.toJSON());
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log(`🔄 Started refreshing ${commandsData.length} application (/) commands.`);

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commandsData }
    );

    console.log(`✅ Successfully reloaded ${commandsData.length} application (/) commands.`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

// For Railway: Create a simple HTTP server to show the bot is running
const port = process.env.PORT || 3000;
const http = require('http');

const server = http.createServer((req: any, res: any) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'Bot is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
});

server.listen(port, () => {
  console.log(`🌐 Health check server running on port ${port}`);
});
