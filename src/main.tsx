// Self-hosted fonts, bundled by Vite. Browsers only fetch the subsets they need.
import '@fontsource-variable/geist-mono/wght.css'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/newsreader/opsz.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'

import { Admin } from './Admin'
import { App } from './App'
import './globals'
import { config } from './lib/wagmi'

const queryClient = new QueryClient()

// The only other page; the Worker serves index.html for every unknown path
const Page =
  window.location.pathname.replace(/\/$/, '') === '/admin' ? Admin : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Page />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
)
