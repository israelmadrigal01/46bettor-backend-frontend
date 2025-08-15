import axios from 'axios';

export async function fetchYouTubeHighlights(teamName) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const query = `${teamName} highlights`;
  const maxResults = 5;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    return response.data.items.map(item => ({
      title: item.snippet.title,
      videoId: item.id.videoId,
      thumbnail: item.snippet.thumbnails.high.url,
      publishedAt: item.snippet.publishedAt,
    }));
  } catch (error) {
    console.error('YouTube API Error:', error.message);
    return [];
  }
}
