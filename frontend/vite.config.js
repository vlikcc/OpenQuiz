/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Libraries big enough that mixing them into a shared chunk would undo the
// route-level splitting. Each maps to the entry that pulls it in.
const VENDOR_CHUNKS = {
  'vendor-charts': ['recharts', 'd3-shape', 'd3-scale', 'victory-vendor'],
  'vendor-katex': ['katex', 'react-markdown', 'rehype-katex', 'remark-math'],
  'vendor-office': ['xlsx', 'mammoth'],
  'vendor-pdf': ['jspdf', 'jspdf-autotable'],
  'vendor-wordcloud': ['d3-cloud', 'd3-selection'],
  'vendor-realtime': ['@microsoft/signalr'],
  'vendor-react': ['react', 'react-dom', 'react-i18next', 'i18next'],
}

function chunkFor(id) {
  // Vite injects a tiny preload helper that every `import()` calls. Rollup
  // otherwise parks it in whichever vendor chunk it sees first — and if that
  // chunk is jspdf, the landing page downloads 400 kB of PDF code just to
  // lazy-load the poll editor.
  if (id.includes('preload-helper')) return 'preload'

  if (!id.includes('node_modules')) return undefined
  const entry = Object.entries(VENDOR_CHUNKS).find(([, packages]) =>
    packages.some((pkg) => id.includes(`node_modules/${pkg}/`)),
  )
  return entry?.[0]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: { manualChunks: chunkFor },
    },
    // The remaining entry chunk should stay well under this; a warning here
    // means something heavy leaked back onto the initial path.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
