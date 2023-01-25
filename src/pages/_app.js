import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { ThemeProvider } from 'styled-components'
import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi'
import { infuraProvider } from 'wagmi/providers/infura'
import { publicProvider } from 'wagmi/providers/public'
import PlausibleProvider from 'next-plausible'

const { chains, provider } = configureChains(
  [chain.mainnet, chain.goerli],
  [infuraProvider({
    stallTimeout: 1_000,
  }), publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: 'ENS Flow',
  chains,
})

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
})

const isProdEnv = process.env.NEXT_PUBLIC_VERCEL_ENV == 'production'

const App = ({ Component, pageProps }) => {
  return (
    <ThemeProvider theme={lightTheme}>
      <ThorinGlobalStyles />
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains}>
          <PlausibleProvider
            domain={isProdEnv ? 'flow.cryptoplaza.app' : 'flow.cryptoplaza.app'}
            trackLocalhost={false}
            trackOutboundLinks
          >
            <Component {...pageProps} />
          </PlausibleProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </ThemeProvider>
  )
}

export default App
