import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { copyFileSync } from 'fs'

import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      // Cloudflare Pages SPA fallback: copy index.html to 404.html after build.
      // Cloudflare serves 404.html for any unmatched route, enabling client-side
      // routing, but NEVER overrides existing static files (/assets/*) so the
      // JS/CSS bundles are always served with the correct MIME type.
      name: 'cf-pages-spa-404',
      closeBundle() {
        copyFileSync('./dist/index.html', './dist/404.html')
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
