// 46bettor-frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // optional: makes local ports predictable
  server: { port: 5173 },
  preview: { port: 5008 },

  // Force-define HMR placeholders so they are harmless if a plugin leaks them
  define: {
    __DEFINES__: {},
    __HMR_PROTOCOL__: JSON.stringify(''),
    __HMR_HOSTNAME__: JSON.stringify(''),
    __HMR_PORT__: JSON.stringify(''),
    __HMR_BASE__: JSON.stringify(''),
    __HMR_TIMEOUT__: JSON.stringify(30000),
    __HMR_ENABLE_OVERLAY__: JSON.stringify(false),
    __HMR_DIRECT_TARGET__: JSON.stringify(''),
    __HMR_CONFIG_NAME__: JSON.stringify(''),
  },
});
