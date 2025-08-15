const axios = require('axios');

const subreddits = [
  'sportsbook',
  'mlb',
  'nba',
  'nfl',
  'wnba',
  'cfb',
  'ncaab',
  'soccer',
  'MMA'
];

const fetchRedditThreads = async () => {
  const threads = [];

  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/top.json?limit=5&t=day`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': '46BettorBot/1.0' }
      });

      const posts = res.data.data.children.map(post => ({
        subreddit: sub,
        title: post.data.title,
        url: `https://reddit.com${post.data.permalink}`,
        score: post.data.score,
        upvote_ratio: post.data.upvote_ratio,
        num_comments: post.data.num_comments
      }));

      threads.push(...posts);
    } catch (error) {
      console.error(`Error fetching r/${sub}:`, error.message);
    }
  }

  return threads;
};

module.exports = { fetchRedditThreads };
