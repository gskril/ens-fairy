import { getDefaultWallets } from '@rainbow-me/rainbowkit'
import { configureChains, createConfig } from 'wagmi'
import { goerli, mainnet } from 'wagmi/chains'
import { infuraProvider } from 'wagmi/providers/infura'

export const chains = [mainnet, goerli]

const { publicClient, webSocketPublicClient } = configureChains(chains, [
  infuraProvider({ apiKey: process.env.NEXT_PUBLIC_INFURA_KEY! }),
])

const { connectors } = getDefaultWallets({
  appName: 'ENS Fairy',
  projectId: 'd6c989fb5e87a19a4c3c14412d5a7672',
  chains,
})

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})
