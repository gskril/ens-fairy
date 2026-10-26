import { getAvailable } from '@ensdomains/ensjs/public'
import { normalize } from '@ensdomains/ensjs/utils'
import { useQuery } from '@tanstack/react-query'

import { type PaymentToken, getGiftPrice } from '../lib/gift'
import type { SupportedChainId } from '../lib/wagmi'
import { useDebounce } from './useDebounce'
import { useEnsClient } from './useEnsClient'

type ParsedLabel =
  { label: string; error?: undefined } | { label?: undefined; error: string }

/** Normalizes user input into a .eth label (without the ".eth" suffix). */
export function parseLabel(input: string): ParsedLabel | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  let label: string
  try {
    label = normalize(trimmed.replace(/\.eth$/i, ''))
  } catch {
    return { error: 'Invalid name' }
  }

  if (label.includes('.')) return { error: 'Subnames are not supported' }
  if ([...label].length < 3) return { error: 'Must be 3+ characters' }
  if (new TextEncoder().encode(label).length > 255) {
    return { error: 'Name is too long' }
  }

  return { label }
}

export function useName({
  input,
  years,
  token,
  chainId,
}: {
  input: string
  years: number
  token: PaymentToken
  chainId: SupportedChainId
}) {
  const debounced = useDebounce(input)
  const parsed = parseLabel(debounced)
  const label = parsed?.label
  const client = useEnsClient(chainId)

  const availability = useQuery({
    queryKey: ['available', chainId, label],
    queryFn: () => getAvailable(client, { name: `${label}.eth` }),
    enabled: !!label,
  })

  const price = useQuery({
    queryKey: ['price', chainId, label, years, token],
    queryFn: () => getGiftPrice(client, { label: label!, years, token }),
    enabled: !!label && availability.data === true && years > 0,
  })

  return {
    label,
    error: parsed?.error,
    isTyping: input !== debounced,
    isAvailable: availability.data,
    isLoading: availability.isLoading,
    price: price.data,
    isPriceLoading: price.isLoading,
  }
}
