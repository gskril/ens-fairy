// Self-hosted fonts, bundled by Vite. Browsers only fetch the subsets they need.
import '@fontsource-variable/geist-mono/wght.css'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/newsreader/opsz.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'

import { App } from './App'
import './globals'
import { config } from './lib/wagmi'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
)
