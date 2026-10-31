import { type Address, type Hex, isAddressEqual, pad, zeroAddress } from 'viem'

/**
 * FairyResolver deployments (contracts/src/FairyResolver.sol), by chain ID.
 * Every gifted name points at it and resolves to its owner until they set
 * records. Gifting shows a maintenance screen on chains left at zeroAddress.
 */
const FAIRY_RESOLVERS: Record<number, Address> = {
  1: '0x73568ddac8406A3d7D375755e04a40bE54d05e41',
  11155111: '0x73568ddac8406A3d7D375755e04a40bE54d05e41',
}

export function getFairyResolver(chainId: number): Address | undefined {
  const address = FAIRY_RESOLVERS[chainId]
  return address && !isAddressEqual(address, zeroAddress) ? address : undefined
}

/** ensfairy.eth, credited as the referrer on every registration */
const REFERRER_ADDRESS: Address = '0x481f50a5BdcCC0bc4322C4dca04301433dED50f0'

/**
 * The registrar takes the referrer as bytes32: the address left-padded.
 * Lowercased, the canonical hex form, since it's also sent to arbitrary RPCs
 * as a log topic filter.
 */
export const FAIRY_REFERRER = pad(REFERRER_ADDRESS, {
  size: 32,
}).toLowerCase() as Hex
