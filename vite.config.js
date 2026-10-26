import { defineConfig } from 'vite';
import { pages } from './src/pages/entries.js';

export default defineConfig({
  appType: 'mpa',
  input: Object.fromEntries(pages.map(({ key, html }) => [key, html])),
});
