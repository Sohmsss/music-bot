import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { queueService } from '../services/queueService';
import { audioService } from '../services/audioService';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resume the paused song');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const member = interaction.member as GuildMember;
  
  if (!member.voice.channel) {
    return interaction.reply({ content: 'You need to be in a voice channel to resume music!', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const serverQueue = queueService.getQueue(guildId);

  if (!serverQueue) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 No Active Queue',
        description: 'There is no active music to resume.'
      }]
    });
  }

  if (member.voice.channel.id !== serverQueue.voiceChannel.id) {
    return interaction.reply({ 
      content: 'You need to be in the same voice channel as the bot to resume music!', 
      ephemeral: true 
    });
  }

  if (serverQueue.playing) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '▶️ Already Playing',
        description: 'The music is already playing. Use `/pause` to pause it.'
      }]
    });
  }

  const success = audioService.resumePlayer(guildId);

  if (success) {
    await interaction.reply({
      embeds: [{
        color: 0x00ff00,
        title: '▶️ Music Resumed',
        description: 'Music has been resumed.',
        footer: {
          text: `Resumed by ${member.displayName}`
        }
      }]
    });
  } else {
    await interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Error',
        description: 'Failed to resume the music. Please try again.'
      }]
    });
  }
}
