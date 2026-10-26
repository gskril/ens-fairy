import { getAddressRecord, getName } from '@ensdomains/ensjs/public'
import { normalize } from '@ensdomains/ensjs/utils'
import { useQuery } from '@tanstack/react-query'
import { type Address, getAddress, isAddress } from 'viem'

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
      const record = await getAddressRecord(client, { name: name! })
      return record?.value ? getAddress(record.value) : null
    },
    enabled: !!name,
  })

  const address = isAddressInput
    ? getAddress(debounced)
    : (forward.data ?? undefined)

  const reverse = useQuery({
    queryKey: ['name', chainId, address],
    queryFn: async () => {
      const result = await getName(client, { address: address! })
      return result?.match ? result.name : null
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
