import type { Client, Transport } from 'viem'
import { usePublicClient } from 'wagmi'

import type { EnsChain } from '../lib/gift'
import type { SupportedChainId } from '../lib/wagmi'

/**
 * Public client for ensjs actions. wagmi types the client as a union of every
 * configured chain, which ensjs can't narrow, so it's typed by the ENS
 * contracts it needs instead.
 */
export function useEnsClient(chainId: SupportedChainId) {
  return usePublicClient({ chainId }) as Client<Transport, EnsChain>
}
