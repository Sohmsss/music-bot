import { VoiceConnection, AudioPlayer } from '@discordjs/voice';

export interface QueueItem {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  requestedBy: string;
  isFromPlaylist?: boolean;
  playlistInfo?: {
    name: string;
    url: string;
    totalSongs: number;
  };
}

export interface ServerQueue {
  textChannel: any;
  voiceChannel: any;
  connection: VoiceConnection | null;
  songs: QueueItem[];
  volume: number;
  playing: boolean;
  player: AudioPlayer | null;
  currentSong: QueueItem | null;
}

export interface YouTubeInfo {
  type: 'video' | 'playlist' | 'search';
  id: string;
  query?: string;
}
