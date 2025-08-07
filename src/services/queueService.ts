import { Collection } from 'discord.js';
import { ServerQueue, QueueItem } from '../types';

class QueueService {
  private queues: Collection<string, ServerQueue> = new Collection();

  getQueue(guildId: string): ServerQueue | undefined {
    return this.queues.get(guildId);
  }

  createQueue(guildId: string, serverQueue: ServerQueue): void {
    this.queues.set(guildId, serverQueue);
  }

  deleteQueue(guildId: string): void {
    this.queues.delete(guildId);
  }

  addToQueue(guildId: string, song: QueueItem): boolean {
    const serverQueue = this.queues.get(guildId);
    if (!serverQueue) return false;

    serverQueue.songs.push(song);
    return true;
  }

  clearQueue(guildId: string): boolean {
    const serverQueue = this.queues.get(guildId);
    if (!serverQueue) return false;

    // Keep only the currently playing song
    if (serverQueue.currentSong) {
      serverQueue.songs = [serverQueue.currentSong];
    } else {
      serverQueue.songs = [];
    }
    return true;
  }

  skipSong(guildId: string): QueueItem | null {
    const serverQueue = this.queues.get(guildId);
    if (!serverQueue || serverQueue.songs.length === 0) return null;

    const skippedSong = serverQueue.songs.shift();
    return skippedSong || null;
  }

  getCurrentSong(guildId: string): QueueItem | null {
    const serverQueue = this.queues.get(guildId);
    if (!serverQueue) return null;
    
    return serverQueue.currentSong;
  }

  getQueueLength(guildId: string): number {
    const serverQueue = this.queues.get(guildId);
    if (!serverQueue) return 0;
    
    return serverQueue.songs.length;
  }

  getUpcomingSongs(guildId: string, limit: number = 10): QueueItem[] {
    const serverQueue = this.queues.get(guildId);
    if (!serverQueue) return [];
    
    // Skip the first song (currently playing) and return next songs
    return serverQueue.songs.slice(1, limit + 1);
  }
}

export const queueService = new QueueService();
