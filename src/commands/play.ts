import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { youtubeService } from '../services/youtubeService';
import { queueService } from '../services/queueService';
import { audioService } from '../services/audioService';
import { ServerQueue } from '../types';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('YouTube URL or search query')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel as VoiceChannel;

  if (!voiceChannel) {
    return interaction.reply({ content: 'You need to be in a voice channel to play music!', ephemeral: true });
  }

  const permissions = voiceChannel.permissionsFor(interaction.client.user!);
  if (!permissions?.has(['Connect', 'Speak'])) {
    return interaction.reply({ content: 'I need permissions to join and speak in your voice channel!', ephemeral: true });
  }

  const query = interaction.options.getString('query', true);
  
  // Defer reply immediately to prevent timeout
  try {
    await interaction.deferReply();
  } catch (error) {
    console.error('Failed to defer reply:', error);
    return;
  }

  try {
    const inputInfo = youtubeService.parseInput(query);
    let songsToAdd: any[] = [];
    let playlistInfo = null;

    // Send an immediate response to let the user know we're processing
    await interaction.editReply('🔍 Processing your request...');

    if (inputInfo.type === 'playlist') {
      const playlistData = await youtubeService.getPlaylistInfo(inputInfo.id);
      if (!playlistData) {
        return interaction.editReply('❌ Could not fetch playlist information. Please check the URL or make sure you have a YouTube API key configured.');
      }
      
      songsToAdd = playlistData.videos;
      playlistInfo = playlistData.info;
      
      if (songsToAdd.length === 0) {
        return interaction.editReply('❌ This playlist appears to be empty or private.');
      }
    } else if (inputInfo.type === 'video') {
      const song = await youtubeService.getVideoInfo(inputInfo.id);
      if (!song) {
        return interaction.editReply('❌ Could not fetch video information. Please check the URL.');
      }
      songsToAdd = [song];
    } else {
      // Search
      const song = await youtubeService.searchVideo(query);
      if (!song) {
        return interaction.editReply('❌ No results found for your search. Make sure you have a YouTube API key configured or try providing a direct YouTube URL.');
      }
      songsToAdd = [song];
    }

    // Set requestedBy for all songs
    songsToAdd.forEach(song => {
      song.requestedBy = `<@${member.id}>`;
    });

    const guildId = interaction.guild.id;
    let serverQueue = queueService.getQueue(guildId);

    if (!serverQueue) {
      // Create new queue
      const connection = await audioService.joinChannel(voiceChannel);
      
      const newQueue: ServerQueue = {
        textChannel: interaction.channel,
        voiceChannel: voiceChannel,
        connection: connection,
        songs: [...songsToAdd],
        volume: 50,
        playing: false,
        player: null,
        currentSong: null
      };

      queueService.createQueue(guildId, newQueue);
      
      if (inputInfo.type === 'playlist') {
        await interaction.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '📋 Playlist Added',
            description: `**${playlistInfo?.title}**\nAdded ${songsToAdd.length} songs to the queue.`,
            thumbnail: songsToAdd[0]?.thumbnail ? { url: songsToAdd[0].thumbnail } : undefined
          }]
        });
      } else {
        await interaction.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ Added to Queue',
            description: `**${songsToAdd[0].title}**`,
            thumbnail: songsToAdd[0]?.thumbnail ? { url: songsToAdd[0].thumbnail } : undefined
          }]
        });
      }

      // Start playing
      await audioService.playNextSong(guildId);
    } else {
      // Add to existing queue
      songsToAdd.forEach(song => {
        queueService.addToQueue(guildId, song);
      });

      if (inputInfo.type === 'playlist') {
        await interaction.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '📋 Playlist Added',
            description: `**${playlistInfo?.title}**\nAdded ${songsToAdd.length} songs to the queue.`,
            fields: [{
              name: 'Queue Position',
              value: `${queueService.getQueueLength(guildId) - songsToAdd.length + 1}-${queueService.getQueueLength(guildId)}`,
              inline: true
            }],
            thumbnail: songsToAdd[0]?.thumbnail ? { url: songsToAdd[0].thumbnail } : undefined
          }]
        });
      } else {
        await interaction.editReply({
          embeds: [{
            color: 0x00ff00,
            title: '✅ Added to Queue',
            description: `**${songsToAdd[0].title}**`,
            fields: [{
              name: 'Queue Position',
              value: `${queueService.getQueueLength(guildId)}`,
              inline: true
            }],
            thumbnail: songsToAdd[0]?.thumbnail ? { url: songsToAdd[0].thumbnail } : undefined
          }]
        });
      }
    }
  } catch (error) {
    console.error('Error in play command:', error);
    await interaction.editReply('❌ An error occurred while trying to play the music.');
  }
}
