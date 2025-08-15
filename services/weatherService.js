// services/weatherService.js
const axios = require('axios');
require('dotenv').config();

const fetchWeatherForTeam = async (team) => {
  const cityMap = {
    Yankees: 'New York',
    RedSox: 'Boston',
    BlueJays: 'Toronto',
    Rays: 'Tampa',
    Orioles: 'Baltimore',
    WhiteSox: 'Chicago',
    Guardians: 'Cleveland',
    Tigers: 'Detroit',
    Royals: 'Kansas City',
    Twins: 'Minneapolis',
    Astros: 'Houston',
    Mariners: 'Seattle',
    Angels: 'Anaheim',
    Rangers: 'Arlington',
    Athletics: 'Oakland',
    Braves: 'Atlanta',
    Marlins: 'Miami',
    Mets: 'New York',
    Phillies: 'Philadelphia',
    Nationals: 'Washington',
    Cardinals: 'St. Louis',
    Cubs: 'Chicago',
    Reds: 'Cincinnati',
    Brewers: 'Milwaukee',
    Pirates: 'Pittsburgh',
    Dodgers: 'Los Angeles',
    Giants: 'San Francisco',
    Padres: 'San Diego',
    Rockies: 'Denver',
    Diamondbacks: 'Phoenix'
  };

  const city = cityMap[team.replace(/\s/g, '')]; // remove spaces
  if (!city) {
    console.warn(`⚠️ No city mapped for team: ${team}`);
    return;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}`;

  try {
    const res = await axios.get(url);
    const weather = res.data;
    console.log(`🌤 Weather for ${team} (${city}): ${weather.weather[0].description}`);
    return weather;
  } catch (err) {
    console.error(`❌ Failed to fetch weather for ${team}:`, err.message);
  }
};

module.exports = { fetchWeatherForTeam };
