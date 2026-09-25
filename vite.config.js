import { defineConfig } from 'vite'

const overpassUserAgent = 'DoratriX/1.0 (https://doratri-x.vercel.app; road network map)'
const overpassProxy = (target) => ({
  target,
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/[^/]+/, ''),
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyRequest) => proxyRequest.setHeader('User-Agent', overpassUserAgent))
  },
})

export default defineConfig({
  server: {
    proxy: {
      '/osm-api': {
        target: 'https://api.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osm-api/, ''),
      },
      '/overpass-de': overpassProxy('https://overpass-api.de'),
      '/overpass-private-coffee': overpassProxy('https://overpass.private.coffee'),
      '/overpass-nchc': overpassProxy('https://overpass.nchc.org.tw'),
    },
  },
})
