import { type Address, isAddressEqual, zeroAddress } from 'viem'

/**
 * FairyResolver deployments (contracts/src/FairyResolver.sol), by chain ID.
 * Every gifted name points at it and resolves to its owner until they set
 * records. Gifting shows a maintenance screen on chains left at zeroAddress.
 */
const FAIRY_RESOLVERS: Record<number, Address> = {
  1: zeroAddress,
  11155111: zeroAddress,
}

export function getFairyResolver(chainId: number): Address | undefined {
  const address = FAIRY_RESOLVERS[chainId]
  return address && !isAddressEqual(address, zeroAddress) ? address : undefined
}
