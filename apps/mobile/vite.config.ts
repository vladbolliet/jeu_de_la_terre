import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev, the game server runs on :3000. `--host` lets phones on the same Wi-Fi connect.
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
});
