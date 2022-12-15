import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import PlausibleProvider from 'next-plausible'
import { AppProps } from 'next/app'
import { ThemeProvider } from 'styled-components'
import { configureChains, createClient, WagmiConfig } from 'wagmi'
import { mainnet, goerli } from 'wagmi/chains'
import { infuraProvider } from 'wagmi/providers/infura'
import { publicProvider } from 'wagmi/providers/public'

import '../styles/globals.css'

if (!process.env.NEXT_PUBLIC_INFURA_KEY) {
  throw new Error('Missing NEXT_PUBLIC_INFURA_KEY')
}

const { chains, provider } = configureChains(
  [mainnet, goerli],
  [
    infuraProvider({ apiKey: process.env.NEXT_PUBLIC_INFURA_KEY }),
    publicProvider(),
  ]
)

const { connectors } = getDefaultWallets({
  appName: 'ENS Fairy',
  chains,
})

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PlausibleProvider domain={'ensfairy.xyz'} trackOutboundLinks>
      <ThemeProvider theme={lightTheme}>
        <ThorinGlobalStyles />
        <WagmiConfig client={wagmiClient}>
          <RainbowKitProvider chains={chains}>
            <Component {...pageProps} />
          </RainbowKitProvider>
        </WagmiConfig>
      </ThemeProvider>
    </PlausibleProvider>
  )
}
