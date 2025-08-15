// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "46bettor-backend",
      script: "index.js",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 5050,
        BANKROLL_START: 250,

        // 🔐 make sure this is quoted
        ADMIN_KEY: "a3eba6d6f587279a64d3e0e64df10bf3f957551947eab0798c454cd3459275e7",

        // ✅ removed the trailing period; keep it quoted
        MONGODB_URI: "mongodb+srv://46bettor:%24W0rkwise46@cluster0.caqo15q.mongodb.net/46bettor?retryWrites=true&w=majority&appName=Cluster0",

        // CORS for prod (plus localhost for dev—remove the localhost entries when fully deployed)
        CORS_ORIGINS: "https://46bettor.com,https://www.46bettor.com,http://localhost:5173,http://127.0.0.1:5173"
      }
    }
  ]
};
