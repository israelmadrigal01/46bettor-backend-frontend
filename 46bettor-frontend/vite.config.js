// 46bettor-frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Guard: if any plugin leaves a __DEFINES__ placeholder, make it a harmless empty object.
  define: { __DEFINES__: {} },
});
