import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so unit tests don't load the Cloudflare and PWA plugins.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
