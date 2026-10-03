import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Safety net: some ported libs reference process.env on the client.
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/video-editor'),
      'next/navigation': path.resolve(__dirname, 'src/video-editor/shims/next-navigation.js'),
      'next/image': path.resolve(__dirname, 'src/video-editor/shims/next-image.jsx'),
      'next-themes': path.resolve(__dirname, 'src/video-editor/shims/next-themes.jsx'),
      'next/server': path.resolve(__dirname, 'src/video-editor/shims/next-server.js'),
    },
  },
  server: { port: 5173 },
  preview: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('@openvideo') ||
              id.includes('pixi.js') ||
              id.includes('@pixi') ||
              id.includes('mediabunny')
            ) {
              return 'vendor-video';
            }
            if (
              id.includes('@radix-ui') ||
              id.includes('radix-ui') ||
              id.includes('@remixicon') ||
              id.includes('framer-motion') ||
              id.includes('motion-dom') ||
              id.includes('motion-utils') ||
              id.includes('sonner')
            ) {
              return 'vendor-ui';
            }
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('zustand') ||
              id.includes('@tanstack')
            ) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
