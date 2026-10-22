import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages serves this repo at https://<domain>/<repo-name>/, so every
// asset URL has to start with the repo name. package.json "name" is the repo name.
export default defineConfig({
  base: `/${pkg.name}/`,
  plugins: [react()],
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
  // the ledger's columns (src/data/cols/<name>.bin.gz) are gzipped typed
  // arrays the page fetches and inflates itself (src/lib/load.ts): plain
  // assets, emitted with hashed names and never transformed. GitHub Pages
  // serves .gz as-is, so nothing double-compresses them.
  assetsInclude: ['**/*.bin.gz'],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx,js,jsx}'], exclude: ['**/node_modules/**', '**/.claude/**', '**/dist/**'] },
  // the ledger's players in their own chunk, so a code change doesn't refetch the data and a data refresh doesn't refetch the app
  build: {
    chunkSizeWarningLimit: 8000,
    // a column is never inlined as a data: URL, however small
    assetsInlineLimit: (file) => (/\.bin\.gz$/.test(file) ? false : undefined),
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'ledger', test: /src[\\/]data[\\/]ledger\.json/ }] } },
    },
  },
})
