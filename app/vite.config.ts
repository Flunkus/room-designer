import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // DEV ONLY: forward Meshy image→3D calls server-side so the browser key (VITE_MESHY_API_KEY)
      // isn't blocked by CORS. The client calls relative "/meshy/..." (see services/meshGen.ts).
      // PRODUCTION must instead route through a real backend that holds the key — do not ship this.
      // API. Context is the full "/meshy/openapi" prefix (NOT just "/meshy") so it doesn't also
      // swallow "/meshy-asset/*" requests — any context starting with "/meshy" would match those.
      '/meshy/openapi': {
        target: 'https://api.meshy.ai',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/meshy/, ''),
      },
      // The generated GLB lives on Meshy's asset CDN, which doesn't send CORS headers — a
      // direct browser fetch (three's loader AND our IDB cache) fails with ERR_FAILED. Proxy
      // it through the same origin too. The presigned query string is preserved by the rewrite.
      '/meshy-asset': {
        target: 'https://assets.meshy.ai',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/meshy-asset/, ''),
      },
    },
  },
})
