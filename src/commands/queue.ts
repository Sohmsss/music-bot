import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { queueService } from '../services/queueService';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current music queue');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }

  const guildId = interaction.guild.id;
  const serverQueue = queueService.getQueue(guildId);

  if (!serverQueue || serverQueue.songs.length === 0) {
    return interaction.reply({
      embeds: [{
        color: 0xff9900,
        title: '📭 Queue Empty',
        description: 'The queue is currently empty. Use `/play` to add some music!'
      }]
    });
  }

  const currentSong = serverQueue.currentSong || serverQueue.songs[0];
  const upcomingSongs = queueService.getUpcomingSongs(guildId, 10);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('🎵 Music Queue')
    .setTimestamp();

  // Current song
  if (currentSong) {
    embed.addFields({
      name: '🎶 Now Playing',
      value: `**${currentSong.title}**\nRequested by ${currentSong.requestedBy}`,
      inline: false
    });
  }

  // Upcoming songs
  if (upcomingSongs.length > 0) {
    const queueList = upcomingSongs
      .map((song, index) => `\`${index + 1}.\` **${song.title}**\nRequested by ${song.requestedBy}`)
      .join('\n\n');

    embed.addFields({
      name: `📋 Up Next (${upcomingSongs.length}/${serverQueue.songs.length - 1} shown)`,
      value: queueList.length > 1024 ? queueList.substring(0, 1021) + '...' : queueList,
      inline: false
    });
  }

  // Queue stats
  const totalSongs = serverQueue.songs.length;
  const totalDuration = serverQueue.songs.reduce((total, song) => total + song.duration, 0);
  
  embed.addFields({
    name: '📊 Queue Stats',
    value: `**Total Songs:** ${totalSongs}\n**Total Duration:** ${formatDuration(totalDuration)}`,
    inline: true
  });

  await interaction.reply({ embeds: [embed] });
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
