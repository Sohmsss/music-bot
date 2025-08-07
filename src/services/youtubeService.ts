import ytdl from '@distube/ytdl-core';
import { google } from 'googleapis';
import { QueueItem, YouTubeInfo } from '../types';

class YouTubeService {
  private youtube: any;

  constructor() {
    // Initialize YouTube API client if API key is provided
    if (process.env.YOUTUBE_API_KEY) {
      this.youtube = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY
      });
      console.log('✅ YouTube Data API v3 initialized');
    } else {
      console.log('⚠️  YouTube API key not found - search and playlists will be disabled');
    }
  }

  parseInput(input: string): YouTubeInfo {
    // Check if it's a playlist URL
    if (input.includes('list=')) {
      const playlistMatch = input.match(/[?&]list=([^&]+)/);
      if (playlistMatch) {
        return { 
          type: 'playlist', 
          id: playlistMatch[1] 
        };
      }
    }
    
    // Check if it's a video URL
    if (input.includes('youtube.com/watch') || input.includes('youtu.be/')) {
      const videoMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (videoMatch) {
        return { 
          type: 'video', 
          id: videoMatch[1] 
        };
      }
    }
    
    // Otherwise treat as search query
    return { 
      type: 'search', 
      id: '', 
      query: input 
    };
  }

  async getVideoInfo(videoId: string): Promise<QueueItem | null> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Fetching video info for ID: ${videoId} (attempt ${attempt}/${maxRetries})`);
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Check if URL is valid
        if (!ytdl.validateURL(url)) {
          console.error('❌ Invalid YouTube URL:', url);
          return null;
        }
        
        // Add timeout and retry logic
        const info = await Promise.race([
          ytdl.getInfo(url, {
            requestOptions: {
              headers: {
                'Cookie': this.getRandomCookie(),
                'User-Agent': this.getRandomUserAgent(),
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
              }
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('YouTube info request timeout')), 15000)
          )
        ]) as any;
        
        console.log('📺 Video info retrieved:', {
          title: info.videoDetails.title,
          url: url,
          duration: parseInt(info.videoDetails.lengthSeconds)
        });
        
        return {
          title: info.videoDetails.title || 'Unknown Title',
          url: url,
          duration: parseInt(info.videoDetails.lengthSeconds) || 0,
          thumbnail: info.videoDetails.thumbnails?.[0]?.url,
          requestedBy: '', // Will be set by command handler
        };
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Error fetching video info for ${videoId} (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Check for specific errors that shouldn't be retried
        if (error.message?.includes('Video unavailable') || 
            error.message?.includes('Private video') ||
            error.message?.includes('This video is not available')) {
          console.log('Video is unavailable - not retrying');
          break;
        }
        
        // Wait before retrying with exponential backoff
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error(`❌ Failed to fetch video info for ${videoId} after ${maxRetries} attempts. Last error:`, lastError?.message);
    return null;
  }

  async searchVideo(query: string): Promise<QueueItem | null> {
    try {
      console.log('🔍 Searching for:', query);
      
      if (!this.youtube) {
        console.log('❌ YouTube API not initialized - please provide a YouTube URL instead');
        return null;
      }

      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults: 1,
        videoCategoryId: '10' // Music category
      });

      if (!response.data.items || response.data.items.length === 0) {
        console.log('❌ No search results found for:', query);
        return null;
      }

      const video = response.data.items[0];
      const videoId = video.id.videoId;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      // Get additional video details
      const detailsResponse = await this.youtube.videos.list({
        part: ['contentDetails', 'snippet'],
        id: [videoId]
      });

      const videoDetails = detailsResponse.data.items[0];
      const duration = this.parseDuration(videoDetails.contentDetails.duration);

      console.log('📺 Search result:', {
        title: video.snippet.title,
        url: url,
        duration: duration
      });

      return {
        title: video.snippet.title || 'Unknown Title',
        url: url,
        duration: duration,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        requestedBy: '', // Will be set by command handler
      };
    } catch (error) {
      console.error('❌ Error searching video for', query, ':', error);
      return null;
    }
  }

  async getPlaylistInfo(playlistId: string): Promise<{ info: any; videos: QueueItem[] } | null> {
    try {
      console.log('🔍 Fetching playlist info for ID:', playlistId);
      
      if (!this.youtube) {
        console.log('❌ YouTube API not initialized - please add videos individually');
        return null;
      }

      // Get playlist details
      const playlistResponse = await this.youtube.playlists.list({
        part: ['snippet'],
        id: [playlistId]
      });

      if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
        console.log('❌ Playlist not found or is private');
        return null;
      }

      const playlistInfo = playlistResponse.data.items[0];

      // Get playlist items (videos)
      const itemsResponse = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: 50 // Limit to 50 videos to prevent API quota issues
      });

      if (!itemsResponse.data.items || itemsResponse.data.items.length === 0) {
        console.log('❌ No videos found in playlist');
        return null;
      }

      const videos: QueueItem[] = [];

      // Get video IDs for duration lookup
      const videoIds = itemsResponse.data.items
        .map((item: any) => item.snippet.resourceId.videoId)
        .filter((id: string) => id); // Filter out null/undefined

      // Get video details for durations
      const detailsResponse = await this.youtube.videos.list({
        part: ['contentDetails'],
        id: videoIds
      });

      const videoDurations: { [key: string]: number } = {};
      if (detailsResponse.data.items) {
        detailsResponse.data.items.forEach((video: any) => {
          videoDurations[video.id] = this.parseDuration(video.contentDetails.duration);
        });
      }

      // Convert to QueueItems
      for (const item of itemsResponse.data.items) {
        const videoId = item.snippet.resourceId.videoId;
        if (videoId && item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video') {
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          
          videos.push({
            title: item.snippet.title || 'Unknown Title',
            url: url,
            duration: videoDurations[videoId] || 0,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            requestedBy: '', // Will be set by command handler
            isFromPlaylist: true,
            playlistInfo: {
              name: playlistInfo.snippet.title || 'Unknown Playlist',
              url: `https://www.youtube.com/playlist?list=${playlistId}`,
              totalSongs: itemsResponse.data.items.length
            }
          });
        }
      }

      console.log(`📋 Loaded ${videos.length} videos from playlist: ${playlistInfo.snippet.title}`);

      return {
        info: {
          title: playlistInfo.snippet.title,
          videoCount: videos.length,
          url: `https://www.youtube.com/playlist?list=${playlistId}`
        },
        videos
      };
    } catch (error) {
      console.error('Error fetching playlist info:', error);
      return null;
    }
  }

  async getAudioStream(url: string) {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add URL validation
        if (!url || url === 'undefined' || typeof url !== 'string') {
          throw new Error(`Invalid URL provided: ${url}`);
        }
        
        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
          throw new Error(`Invalid YouTube URL: ${url}`);
        }
        
        console.log(`🎵 Attempting to stream from URL: ${url} (attempt ${attempt}/${maxRetries})`);
        
        // Get audio stream with optimal quality and headers
        const stream = ytdl(url, {
          filter: 'audioonly',
          quality: 'highestaudio',
          highWaterMark: 1 << 25, // 32MB buffer
          requestOptions: {
            headers: {
              'Cookie': this.getRandomCookie(),
              'User-Agent': this.getRandomUserAgent(),
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          }
        });
        
        return {
          stream,
          type: 'opus'
        };
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Error creating audio stream (attempt ${attempt}/${maxRetries}):`, error.message);
        
        // Check for specific errors that shouldn't be retried
        if (error.message?.includes('Video unavailable') || 
            error.message?.includes('Private video') ||
            error.message?.includes('This video is not available')) {
          console.log('Video is unavailable - not retrying');
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.error(`❌ Failed to create audio stream for ${url} after ${maxRetries} attempts. Last error:`, lastError?.message);
    throw lastError;
  }

  // Helper method to parse YouTube duration format (PT4M13S) to seconds
  private parseDuration(duration: string): number {
    try {
      const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!matches) return 0;

      const hours = parseInt(matches[1] || '0');
      const minutes = parseInt(matches[2] || '0');
      const seconds = parseInt(matches[3] || '0');

      return hours * 3600 + minutes * 60 + seconds;
    } catch {
      return 0;
    }
  }

  // Helper method to get random user agent to avoid bot detection
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  // Helper method to get random cookie to avoid bot detection
  private getRandomCookie(): string {
    const sessionIds = Array.from({length: 32}, () => Math.random().toString(36)[2]).join('');
    return `CONSENT=YES+cb.20210328-17-p0.en+FX+${Math.floor(Math.random() * 999)}; VISITOR_INFO1_LIVE=${sessionIds}`;
  }
}

export const youtubeService = new YouTubeService();