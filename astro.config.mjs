// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import { remarkCta } from './src/plugins/remark-cta.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  markdown: {
    remarkPlugins: [remarkCta],
  },
  vite: {
    plugins: [tailwindcss()],
    cacheDir: '/tmp/vite-cache',
  },
});
