import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { queueService } from '../services/queueService';
import { audioService } from '../services/audioService';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause the current song');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const member = interaction.member as GuildMember;
  
  if (!member.voice.channel) {
    return interaction.reply({ content: 'You need to be in a voice channel to pause music!', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const serverQueue = queueService.getQueue(guildId);

  if (!serverQueue) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 No Active Queue',
        description: 'There is no active music to pause.'
      }]
    });
  }

  if (member.voice.channel.id !== serverQueue.voiceChannel.id) {
    return interaction.reply({ 
      content: 'You need to be in the same voice channel as the bot to pause music!', 
      ephemeral: true 
    });
  }

  if (!serverQueue.playing) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '⏸️ Already Paused',
        description: 'The music is already paused. Use `/resume` to continue playing.'
      }]
    });
  }

  const success = audioService.pausePlayer(guildId);

  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0x00ff00,
        title: '⏸️ Music Paused',
        description: 'Music has been paused. Use `/resume` to continue playing.',
        footer: {
          text: `Paused by ${member.displayName}`
        }
      }]
    });
  } else {
    await interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: 'Failed to pause the music. Please try again.'
      }]
    });
  }
}
