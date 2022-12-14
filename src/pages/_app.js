import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import PlausibleProvider from 'next-plausible'
import { ThemeProvider } from 'styled-components'
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi'
import { infuraProvider } from 'wagmi/providers/infura'
import { publicProvider } from 'wagmi/providers/public'

import '../styles/globals.css'

const { chains, provider } = configureChains(
  [chain.mainnet, chain.goerli],
  [infuraProvider({}), publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: 'My RainbowKit App',
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
            domain={isProdEnv ? 'ensfairy.xyz' : 'dev.ensfairy.xyz'}
            trackLocalhost={!isProdEnv}
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
