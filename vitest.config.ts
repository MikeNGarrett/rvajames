import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { transformWithEsbuild } from 'vite';

export default defineConfig({
  plugins: [
    {
      // tsconfig.json sets jsx:"preserve" for Next.js, which causes
      // vite:import-analysis to reject .tsx files. This pre-transform
      // converts JSX/TSX to JS before import analysis sees it, enabling
      // renderToStaticMarkup-based component tests without @vitejs/plugin-react.
      name: 'vitest-jsx-transform',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) return;
        return transformWithEsbuild(code, id, {
          loader: 'tsx',
          jsx: 'automatic',
          jsxImportSource: 'react',
        });
      },
    },
  ],
  resolve: {
    alias: {
      // Match the "@/*" -> "./*" path mapping from tsconfig.json
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
