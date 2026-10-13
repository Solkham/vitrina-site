import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  build: { target: 'es2022', rollupOptions: { input: { main: resolve(__dirname, 'index.html'), kabinet: resolve(__dirname, 'kabinet.html') } } }
});
