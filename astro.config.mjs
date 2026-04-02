// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import { remarkCta } from './src/plugins/remark-cta.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://www.grgindia.in',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkCta],
  },
  vite: {
    plugins: [tailwindcss()],
    cacheDir: '/tmp/vite-cache',
  },
});
