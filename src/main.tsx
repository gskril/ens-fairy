// Self-hosted fonts, bundled by Vite. Browsers only fetch the subsets they need.
import '@fontsource-variable/geist-mono/wght.css'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/newsreader/opsz.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'

import { App } from './App'
import './globals'
import { config } from './lib/wagmi'

const queryClient = new QueryClient()

// The only other page, loaded on its own so the gift flow doesn't carry it.
// The Worker serves index.html for every unknown path.
const Admin = lazy(() => import('./Admin').then((m) => ({ default: m.Admin })))
const Page =
  window.location.pathname.replace(/\/$/, '') === '/admin' ? Admin : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Suspense>
          <Page />
        </Suspense>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
)
