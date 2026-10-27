import { useQuery } from '@tanstack/react-query'
import { type Address, getAddress, isAddress } from 'viem'
import { getEnsAddress, getEnsName } from 'viem/actions'
import { normalize } from 'viem/ens'

import type { SupportedChainId } from '../lib/wagmi'
import { useDebounce } from './useDebounce'
import { useEnsClient } from './useEnsClient'

export type Recipient = {
  address: Address
  name?: string
}

/** Resolves an address or ENS name into a recipient. */
export function useRecipient({
  input,
  chainId,
}: {
  input: string
  chainId: SupportedChainId
}) {
  const debounced = useDebounce(input.trim())
  const client = useEnsClient(chainId)

  const isAddressInput = isAddress(debounced, { strict: false })
  let name: string | undefined
  if (!isAddressInput && debounced.includes('.')) {
    try {
      name = normalize(debounced)
    } catch {
      name = undefined
    }
  }

  const forward = useQuery({
    queryKey: ['address', chainId, name],
    queryFn: async () => {
      const address = await getEnsAddress(client, { name: name! })
      return address ? getAddress(address) : null
    },
    enabled: !!name,
  })

  const address = isAddressInput
    ? getAddress(debounced)
    : (forward.data ?? undefined)

  const reverse = useQuery({
    queryKey: ['name', chainId, address],
    queryFn: async () => {
      // Only returns a name whose forward resolution matches the address
      return getEnsName(client, { address: address! })
    },
    enabled: !!address && isAddressInput,
  })

  const isLoading = input.trim() !== debounced || forward.isLoading
  const error =
    !debounced || isLoading
      ? undefined
      : !isAddressInput && !name
        ? 'Enter an address or ENS name'
        : name && forward.isFetched && !address
          ? 'Name does not resolve to an address'
          : undefined

  const recipient: Recipient | undefined = address
    ? { address, name: name ?? reverse.data ?? undefined }
    : undefined

  return { recipient, isLoading, error }
}
