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
            // Chunk by dependency group, not by substring. A previous
            // `id.includes('react')` matched too much (@tanstack/react-query,
            // react-colorful), which split React Router from its own
            // @remix-run/router dependency and produced a circular chunk
            // (vendor -> vendor-react -> vendor). Each group below is
            // self-contained, so no group imports another.
            if (
              /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|zustand)[\\/]/.test(id)
              // react-router v6 delegates to @remix-run/router; keep it together
              || /node_modules[\\/](@remix-run)[\\/]/.test(id)
              // @tanstack/react-query wraps React, so it belongs on this side too
              || /node_modules[\\/](@tanstack)[\\/]/.test(id)
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
