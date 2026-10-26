import { addEnsContracts } from '@ensdomains/ensjs'
import { mainnet as _mainnet, sepolia as _sepolia } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

export const mainnet = addEnsContracts(_mainnet)
export const sepolia = addEnsContracts(_sepolia)

export const chains = [mainnet, sepolia] as const
export type SupportedChainId = (typeof chains)[number]['id']

// RPC requests go through the Cloudflare Worker so private RPC URLs stay secret
const rpc = (chainId: number) =>
  http(`${window.location.origin}/rpc/${chainId}`, { batch: true })

export const WALLETCONNECT_PROJECT_ID = 'd6c989fb5e87a19a4c3c14412d5a7672'

export const config = createConfig({
  chains,
  connectors: [
    injected(),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      showQrModal: false,
      metadata: {
        name: 'ENS Fairy',
        description: 'Register an ENS name directly to another address',
        url: 'https://ensfairy.xyz',
        icons: ['https://ensfairy.xyz/favicon.ico'],
      },
    }),
  ],
  transports: {
    [mainnet.id]: rpc(mainnet.id),
    [sepolia.id]: rpc(sepolia.id),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

export function isSupportedChain(
  chainId: number | undefined
): chainId is SupportedChainId {
  return chains.some((chain) => chain.id === chainId)
}

export function getChain(chainId: number | undefined) {
  return chains.find((chain) => chain.id === chainId) ?? mainnet
}

export function explorerUrl(chainId: number | undefined) {
  return getChain(chainId).blockExplorers.default.url
}
