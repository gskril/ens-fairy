/**
 * Dry-runs a full gift (approval, commit, register) against live
 * chain state with eth_simulateV1, to check that registrations work end to end.
 *
 *   bun run check            # mainnet
 *   bun run check sepolia    # sepolia (needs an account holding test USDC)
 *
 * Set CHECK_ACCOUNT to simulate from a specific address that holds USDC. Uses the
 * FairyResolver from src/lib/contracts.ts when set; the registrar doesn't
 * check it, so any address works for the dry run.
 */
import { addEnsContracts } from '@ensdomains/ensjs'
import { randomSecret } from '@ensdomains/ensjs/utils'
import { type Address, createClient, http, zeroAddress } from 'viem'
import { mainnet, sepolia } from 'viem/chains'

import { getFairyResolver } from '../src/lib/contracts'
import { dryRunGift, getErrorMessage } from '../src/lib/gift'

const isSepolia = process.argv[2] === 'sepolia'
const chain = addEnsContracts(isSepolia ? sepolia : mainnet)
const rpc =
  process.env.RPC_URL ??
  (isSepolia
    ? 'https://ethereum-sepolia-rpc.publicnode.com'
    : 'https://ethereum-rpc.publicnode.com')

// An exchange hot wallet that holds plenty of mainnet USDC
const account = (process.env.CHECK_ACCOUNT ??
  '0x28C6c06298d514Db089934071355E5743bf21d60') as Address
const label = `ensfairycheck${Math.floor(Math.random() * 1e9)}`

const client = createClient({ chain, transport: http(rpc) })
const failure = await dryRunGift(client, {
  account,
  label,
  recipient: '0x000000000000000000000000000000000000fa1e',
  years: 1,
  token: 'usdc',
  secret: randomSecret(),
  resolverAddress: getFairyResolver(chain.id) ?? zeroAddress,
})

if (failure) {
  console.error(`✗ ${chain.name}: ${getErrorMessage(failure)}`)
  process.exit(1)
}

console.log(`✓ ${chain.name}: gifting ${label}.eth would succeed`)
