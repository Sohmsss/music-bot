import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { queueService } from '../services/queueService';
import { audioService } from '../services/audioService';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop the music and clear the queue');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const member = interaction.member as GuildMember;
  
  if (!member.voice.channel) {
    return interaction.reply({ content: 'You need to be in a voice channel to stop music!', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const serverQueue = queueService.getQueue(guildId);

  if (!serverQueue) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 No Active Queue',
        description: 'There is no active music to stop.'
      }]
    });
  }

  if (member.voice.channel.id !== serverQueue.voiceChannel.id) {
    return interaction.reply({ 
      content: 'You need to be in the same voice channel as the bot to stop music!', 
      ephemeral: true 
    });
  }

  const currentSong = queueService.getCurrentSong(guildId);
  const queueLength = queueService.getQueueLength(guildId);

  // Stop the player and clear the queue
  audioService.stopPlayer(guildId);
  
  // Clear all songs from queue
  serverQueue.songs = [];
  serverQueue.currentSong = null;
  serverQueue.playing = false;

  // Disconnect from voice channel
  if (serverQueue.connection) {
    await audioService.leaveChannel(serverQueue.connection);
  }

  // Remove the queue
  queueService.deleteQueue(guildId);

  await interaction.reply({
    embeds: [{
      color: 0x00ff00,
      title: '⏹️ Music Stopped',
      description: `Stopped playing${currentSong ? ` **${currentSong.title}**` : ''} and cleared ${queueLength} song${queueLength !== 1 ? 's' : ''} from the queue.`,
      footer: {
        text: `Stopped by ${member.displayName}`
      }
    }]
  });
}
