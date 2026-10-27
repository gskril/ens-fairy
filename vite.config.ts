import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { type Plugin, defineConfig } from 'vite'
import { zyzz } from 'zyzz/vite'

// The fontsource CSS is only applied once React renders, so browsers don't
// discover the font files until the JS bundle has downloaded and run. On slow
// mobile connections the page paints with fallback fonts first and then
// shifts when the web fonts swap in. Preloading the Latin subsets lets them
// download in parallel with the JS.
function preloadFonts(): Plugin {
  const fonts =
    /^(geist-mono|inter-tight|newsreader)-latin-(wght|opsz)-normal-.*\.woff2$/

  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        return Object.values(bundle ?? {})
          .filter((file) => fonts.test(file.fileName.split('/').pop() ?? ''))
          .map((file) => ({
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `/${file.fileName}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head-prepend' as const,
          }))
      },
    },
  }
}

export default defineConfig({
  plugins: [
    zyzz({ reset: true, include: ['src/**'] }),
    react(),
    cloudflare(),
    preloadFonts(),
  ],
})
