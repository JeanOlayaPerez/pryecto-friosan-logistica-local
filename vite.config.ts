import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['chrome 56'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
});
