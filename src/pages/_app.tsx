import { ThorinGlobalStyles, lightTheme } from '@ensdomains/thorin'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import PlausibleProvider from 'next-plausible'
import { AppProps } from 'next/app'
import { ThemeProvider } from 'styled-components'
import { WagmiConfig } from 'wagmi'

import { chains, wagmiConfig } from '../lib/providers'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PlausibleProvider domain={'ensfairy.xyz'} trackOutboundLinks>
      <ThemeProvider theme={lightTheme}>
        <ThorinGlobalStyles />
        <WagmiConfig config={wagmiConfig}>
          <RainbowKitProvider chains={chains} modalSize="compact">
            <Component {...pageProps} />
          </RainbowKitProvider>
        </WagmiConfig>
      </ThemeProvider>
    </PlausibleProvider>
  )
}
