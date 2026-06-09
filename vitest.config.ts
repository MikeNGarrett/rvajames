import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { transformWithOxc } from 'vite';

export default defineConfig({
  plugins: [
    {
      // tsconfig.json sets jsx:"preserve" for Next.js, which causes
      // vite:import-analysis to reject .tsx files. This pre-transform
      // converts JSX/TSX to JS before import analysis sees it, enabling
      // renderToStaticMarkup-based component tests without @vitejs/plugin-react.
      //
      // Migrated from transformWithEsbuild (deprecated in vite@8+) to
      // transformWithOxc. API differences:
      //   loader: 'tsx'        → lang: 'tsx'
      //   jsx: 'automatic'     → jsx: { runtime: 'automatic' }
      //   jsxImportSource: ... → jsx: { ..., importSource: ... }
      name: 'vitest-jsx-transform',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) return;
        return transformWithOxc(code, id, {
          lang: 'tsx',
          jsx: {
            runtime: 'automatic',
            importSource: 'react',
          },
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
