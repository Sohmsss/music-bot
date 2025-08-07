import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { queueService } from '../services/queueService';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear the music queue');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const member = interaction.member as GuildMember;
  
  // Check if user is in a voice channel
  if (!member.voice.channel) {
    return interaction.reply({ content: 'You need to be in a voice channel to clear the queue!', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const serverQueue = queueService.getQueue(guildId);

  if (!serverQueue) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 No Active Queue',
        description: 'There is no active music queue to clear.'
      }]
    });
  }

  // Check if user is in the same voice channel as the bot
  if (member.voice.channel.id !== serverQueue.voiceChannel.id) {
    return interaction.reply({ 
      content: 'You need to be in the same voice channel as the bot to clear the queue!', 
      ephemeral: true 
    });
  }

  const queueLength = queueService.getQueueLength(guildId);
  const currentSong = queueService.getCurrentSong(guildId);
  
  if (queueLength <= 1) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 Queue Already Empty',
        description: currentSong ? 
          'Only the currently playing song remains in the queue.' : 
          'The queue is already empty.'
      }]
    });
  }

  // Clear the queue (keeping current song)
  const success = queueService.clearQueue(guildId);

  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0x00ff00,
        title: '🗑️ Queue Cleared',
        description: `Successfully cleared ${queueLength - 1} songs from the queue.${currentSong ? '\n\nThe currently playing song will continue.' : ''}`,
        footer: {
          text: `Cleared by ${member.displayName}`
        }
      }]
    });
  } else {
    await interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: 'Failed to clear the queue. Please try again.'
      }]
    });
  }
}
