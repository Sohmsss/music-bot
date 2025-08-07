import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { queueService } from '../services/queueService';
import { audioService } from '../services/audioService';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current song');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const member = interaction.member as GuildMember;
  
  // Check if user is in a voice channel
  if (!member.voice.channel) {
    return interaction.reply({ content: 'You need to be in a voice channel to skip songs!', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const serverQueue = queueService.getQueue(guildId);

  if (!serverQueue) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 No Active Queue',
        description: 'There is no active music queue to skip.'
      }]
    });
  }

  // Check if user is in the same voice channel as the bot
  if (member.voice.channel.id !== serverQueue.voiceChannel.id) {
    return interaction.reply({ 
      content: 'You need to be in the same voice channel as the bot to skip songs!', 
      ephemeral: true 
    });
  }

  const currentSong = queueService.getCurrentSong(guildId);
  
  if (!currentSong || queueService.getQueueLength(guildId) === 0) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 Nothing to Skip',
        description: 'There is no song currently playing to skip.'
      }]
    });
  }

  // Stop the current player to trigger the next song
  const success = audioService.stopPlayer(guildId);

  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0x00ff00,
        title: '⏭️ Song Skipped',
        description: `Skipped **${currentSong.title}**`,
        footer: {
          text: `Skipped by ${member.displayName}`
        }
      }]
    });
  } else {
    await interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: 'Failed to skip the current song. Please try again.'
      }]
    });
  }
}
