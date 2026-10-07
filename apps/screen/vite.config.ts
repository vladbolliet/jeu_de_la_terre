import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served by the game server at /screen in production.
  base: '/screen/',
  server: {
    port: 5174,
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
