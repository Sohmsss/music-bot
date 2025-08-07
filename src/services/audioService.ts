import { 
  createAudioPlayer, 
  createAudioResource, 
  joinVoiceChannel, 
  VoiceConnection, 
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { youtubeService } from './youtubeService';
import { queueService } from './queueService';
import { ServerQueue } from '../types';

class AudioService {
  async joinChannel(voiceChannel: VoiceChannel): Promise<VoiceConnection> {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30000);
      return connection;
    } catch (error) {
      connection.destroy();
      throw error;
    }
  }

  async playNextSong(guildId: string): Promise<void> {
    const serverQueue = queueService.getQueue(guildId);
    if (!serverQueue || !serverQueue.connection) return;

    if (serverQueue.songs.length === 0) {
      serverQueue.playing = false;
      serverQueue.currentSong = null;
      await this.leaveChannel(serverQueue.connection);
      queueService.deleteQueue(guildId);
      return;
    }

    const song = serverQueue.songs[0];
    serverQueue.currentSong = song;

    try {
      // Validate song URL before attempting to stream
      if (!song.url || song.url === 'undefined') {
        throw new Error(`Invalid song URL: ${song.url}`);
      }

      console.log('🎵 Starting playback for:', song.title);
      const streamData = await youtubeService.getAudioStream(song.url);
      const resource = createAudioResource(streamData.stream);

      if (!serverQueue.player) {
        serverQueue.player = createAudioPlayer();
        this.setupPlayerEvents(serverQueue.player, guildId);
        serverQueue.connection.subscribe(serverQueue.player);
      }

      serverQueue.player.play(resource);
      serverQueue.playing = true;

      // Send now playing message
      if (serverQueue.textChannel) {
        const embed = {
          color: 0x0099ff,
          title: '🎵 Now Playing',
          description: `**${song.title}**`,
          thumbnail: song.thumbnail ? { url: song.thumbnail } : undefined,
          fields: [
            {
              name: 'Duration',
              value: this.formatDuration(song.duration),
              inline: true
            },
            {
              name: 'Requested by',
              value: song.requestedBy,
              inline: true
            }
          ]
        };

        await serverQueue.textChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('❌ Error playing song:', error);
      
      // Skip this song and try the next one
      const skippedSong = queueService.skipSong(guildId);
      
      if (serverQueue.textChannel) {
        await serverQueue.textChannel.send(`❌ Error playing **${song.title}**. ${skippedSong ? 'Skipping to next song...' : 'Queue is now empty.'}`);
      }
      
      // Only try to play next song if there are more songs in queue
      if (queueService.getQueueLength(guildId) > 0) {
        await this.playNextSong(guildId);
      } else {
        // No more songs, clean up
        serverQueue.playing = false;
        serverQueue.currentSong = null;
        await this.leaveChannel(serverQueue.connection);
        queueService.deleteQueue(guildId);
      }
    }
  }

  private setupPlayerEvents(player: AudioPlayer, guildId: string): void {
    player.on(AudioPlayerStatus.Idle, async () => {
      // Song finished, remove it from queue and play next
      queueService.skipSong(guildId);
      await this.playNextSong(guildId);
    });

    player.on('error', async (error) => {
      console.error('Audio player error:', error);
      
      // Skip problematic song and continue
      queueService.skipSong(guildId);
      await this.playNextSong(guildId);
    });
  }

  async leaveChannel(connection: VoiceConnection): Promise<void> {
    try {
      connection.destroy();
    } catch (error) {
      console.error('Error leaving voice channel:', error);
    }
  }

  pausePlayer(guildId: string): boolean {
    const serverQueue = queueService.getQueue(guildId);
    if (!serverQueue?.player) return false;

    const success = serverQueue.player.pause();
    if (success) {
      serverQueue.playing = false;
    }
    return success;
  }

  resumePlayer(guildId: string): boolean {
    const serverQueue = queueService.getQueue(guildId);
    if (!serverQueue?.player) return false;

    const success = serverQueue.player.unpause();
    if (success) {
      serverQueue.playing = true;
    }
    return success;
  }

  stopPlayer(guildId: string): boolean {
    const serverQueue = queueService.getQueue(guildId);
    if (!serverQueue?.player) return false;

    serverQueue.player.stop();
    serverQueue.playing = false;
    return true;
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

export const audioService = new AudioService();
