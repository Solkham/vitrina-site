import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  build: { target: 'es2022', rollupOptions: { input: { main: resolve(__dirname, 'index.html'), kabinet: resolve(__dirname, 'kabinet.html'), probyA: resolve(__dirname, 'proby-a.html'), probyB: resolve(__dirname, 'proby-b.html'), probyC: resolve(__dirname, 'proby-c.html') } } }
});
