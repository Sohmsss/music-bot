# Discord Music Bot

A powerful Discord music bot built with TypeScript, discord.js, and play-dl. Features YouTube playlist support and Railway deployment ready.

## Features

- 🎵 Play music from YouTube (videos and playlists)
- 🔍 Search for songs by name
- 📋 Queue management (view, clear, skip)
- ⏯️ Playback controls (play, pause, resume, stop)
- 🎭 Rich embed messages with song information
- 🚀 Ready for Railway deployment
- 📦 Docker containerized

## Commands

- `/play <query>` - Play a song from YouTube URL or search query
- `/queue` - Show the current music queue
- `/clear` - Clear the music queue
- `/skip` - Skip the current song
- `/pause` - Pause the current song
- `/resume` - Resume the paused song
- `/stop` - Stop the music and clear the queue

## Setup

### Prerequisites

1. Node.js 18+ installed
2. A Discord Bot Token
3. Discord Application ID

### Local Development

1. Clone the repository
2. Copy `env.example` to `.env` and fill in your Discord credentials:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CLIENT_ID=your_discord_client_id
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run in development mode:
   ```bash
   npm run dev
   ```

### Production Build

```bash
npm run build
npm start
```

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Set the following environment variables in Railway:
   - `DISCORD_TOKEN` - Your Discord bot token
   - `DISCORD_CLIENT_ID` - Your Discord application ID
3. Railway will automatically deploy using the included Dockerfile

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token for your `.env` file
5. Go to "OAuth2" > "URL Generator"
6. Select scopes: `bot` and `applications.commands`
7. Select permissions: `Connect`, `Speak`, `Send Messages`, `Use Slash Commands`
8. Use the generated URL to invite the bot to your server

## Architecture

- **TypeScript** for type safety
- **discord.js v14** for Discord API interaction
- **@discordjs/voice** for voice channel functionality
- **play-dl** for YouTube audio streaming
- **Modular service architecture** for maintainability
- **Docker** for containerized deployment
- **Railway** for cloud hosting

## File Structure

```
src/
├── commands/         # Slash command implementations
├── services/         # Business logic services
│   ├── audioService.ts
│   ├── queueService.ts
│   └── youtubeService.ts
├── types/           # TypeScript type definitions
└── index.ts         # Main bot entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
