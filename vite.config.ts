import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

export default defineConfig({
  plugins: [zyzz({ reset: true, include: ['src/**'] }), react(), cloudflare()],
})
