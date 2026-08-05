import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    legacy({
      targets: ['chrome 56'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
});
