// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { remarkCta } from './src/plugins/remark-cta.mjs';

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkCta],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});