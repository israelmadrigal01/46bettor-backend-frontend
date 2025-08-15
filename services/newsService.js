// services/newsService.js
const axios = require('axios');
const NEWS_API_KEY = process.env.NEWS_API_KEY;

const fetchSportsNews = async () => {
  try {
    const response = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        apikey: NEWS_API_KEY,
        q: 'sports OR NBA OR NFL OR MLB OR NHL',
        language: 'en',
        category: 'sports',
      }
    });
    return response.data.results;
  } catch (err) {
    console.error('Error fetching sports news:', err.message);
    return [];
  }
};

module.exports = { fetchSportsNews };
