import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web/public',
  build: {
    outDir: '../../../dist/web/public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/web/public/index.html'
      }
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
}); 