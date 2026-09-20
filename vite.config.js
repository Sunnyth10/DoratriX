import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/osm-api': {
        target: 'https://api.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osm-api/, ''),
      },
    },
  },
})
