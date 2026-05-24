import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  resolve: {
    alias: {
      // Match the "@/*" -> "./*" path mapping from tsconfig.json
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
