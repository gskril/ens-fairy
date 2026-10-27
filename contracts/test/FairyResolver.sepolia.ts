/**
 * Integration test for FairyResolver against live Sepolia state, using
 * eth_simulateV1. Deploys the resolver, gifts a name that uses it through the
 * real ENSv2 registrar, then checks resolution through the Universal Resolver,
 * the ENS manager's edit check, and access control.
 *
 *   bun contracts/build.ts && bun contracts/test/FairyResolver.sepolia.ts
 */
import { addEnsContracts } from '@ensdomains/ensjs'
import { universalResolverResolveSnippet } from '@ensdomains/ensjs-abi/universalResolver'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { randomSecret } from '@ensdomains/ensjs/utils'
import {
  type Address,
  type Hex,
  createClient,
  decodeAbiParameters,
  decodeErrorResult,
  encodeDeployData,
  encodeFunctionData,
  getContractAddress,
  http,
  parseAbi,
  toFunctionSelector,
  toHex,
} from 'viem'
import { getBlock, simulateBlocks } from 'viem/actions'
import { sepolia as viemSepolia } from 'viem/chains'
import { namehash, packetToBytes } from 'viem/ens'

import { getGiftCalls, getGiftPrice } from '../../src/lib/gift'
import artifact from '../out/FairyResolver.json'

const chain = addEnsContracts(viemSepolia)
const client = createClient({
  chain,
  transport: http(
    process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'
  ),
})

const abi = artifact.abi
const deployer = '0x00000000000000000000000000000000000fa1e0' as Address
const gifter = '0x1111111111111111111111111111111111111aaa' as Address
const recipient = '0x2222222222222222222222222222222222222bbb' as Address
const stranger = '0x3333333333333333333333333333333333333ccc' as Address
const operator = '0x4444444444444444444444444444444444444ddd' as Address
const elsewhere = '0x5555555555555555555555555555555555555eee' as Address

const label = `fairyshared${Math.floor(Math.random() * 1e9)}`
const name = `${label}.eth`
const dnsName = toHex(packetToBytes(name))
const node = namehash(name)

const ethRegistry = getChainContractAddress({ chain, contract: 'ensRegistry' })
const usdc = getChainContractAddress({ chain, contract: 'usdc' })
const universalResolver = getChainContractAddress({
  chain,
  contract: 'ensUniversalResolver',
})
const resolver = getContractAddress({ from: deployer, nonce: 0n })

const call = (account: Address, functionName: string, args: unknown[]) => ({
  account,
  to: resolver,
  data: encodeFunctionData({ abi, functionName, args } as never),
})

/** Like `call`, but the simulation decodes the return value. */
const view = (functionName: string, args: unknown[]) => ({
  account: stranger,
  to: resolver,
  abi,
  functionName,
  args,
})

const profileAbi = parseAbi([
  'function addr(bytes32) view returns (address)',
  'function addr(bytes32, uint256) view returns (bytes)',
  'function text(bytes32, string) view returns (string)',
])
const resolveThroughUR = (data: Hex) => ({
  account: stranger,
  to: universalResolver,
  abi: universalResolverResolveSnippet,
  functionName: 'resolve',
  args: [dnsName, data],
})
const resolveAddr = () =>
  resolveThroughUR(
    encodeFunctionData({
      abi: profileAbi,
      functionName: 'addr',
      args: [node],
    })
  )
const resolveText = (key: string) =>
  resolveThroughUR(
    encodeFunctionData({
      abi: profileAbi,
      functionName: 'text',
      args: [node, key],
    })
  )

// Gift calls built by the app, pointed at the shared resolver
const setup = {
  account: gifter,
  label,
  recipient,
  years: 1,
  token: 'usdc' as const,
  secret: randomSecret(),
  salt: 0n,
}
const { total } = await getGiftPrice(client, setup)
const gift = getGiftCalls(client, {
  ...setup,
  resolverAddress: resolver,
  approveAmount: total,
})
const { timestamp } = await getBlock(client)
const at = (seconds: number) => ({ time: timestamp + BigInt(seconds) })

const blocks = [
  {
    name: 'deploy + fund',
    blockOverrides: at(12),
    stateOverrides: [
      { address: deployer, balance: 10n ** 19n },
      { address: gifter, balance: 10n ** 19n },
    ],
    calls: [
      {
        account: deployer,
        data: encodeDeployData({
          abi,
          bytecode: artifact.bytecode as Hex,
          args: [ethRegistry],
        }),
        gas: 30_000_000n,
      },
      {
        account: gifter,
        to: usdc,
        data: encodeFunctionData({
          abi: parseAbi(['function mint(address,uint256)']),
          args: [gifter, total],
        }),
      },
    ],
  },
  {
    name: 'gift batch (approve + commit)',
    blockOverrides: at(24),
    calls: [
      { account: gifter, ...gift.approve },
      { account: gifter, ...gift.commit },
    ],
  },
  {
    name: 'register',
    blockOverrides: at(600),
    calls: [{ account: gifter, ...gift.register }],
  },
  {
    name: 'after registration',
    blockOverrides: at(612),
    calls: [
      resolveAddr(), // 0: resolves to the recipient with no records set
      view('supportsInterface', [
        toFunctionSelector('setAddress(bytes,uint256,bytes)'),
      ]), // 1
      call(recipient, 'setAddress', [dnsName, 60n, recipient]), // 2: manager dry run
      call(gifter, 'setAddress', [dnsName, 60n, gifter]), // 3: gifter can't write
      call(stranger, 'setText', [dnsName, 'url', 'https://evil']), // 4
      view('canModifyName', [dnsName, recipient]), // 5
      view('ownerOf', [dnsName]), // 6
    ],
  },
  {
    name: 'recipient edits records',
    blockOverrides: at(624),
    calls: [
      call(recipient, 'multicall', [
        [
          encodeFunctionData({
            abi,
            functionName: 'setText',
            args: [dnsName, 'description', 'gifted with ENS Fairy'],
          }),
          encodeFunctionData({
            abi,
            functionName: 'setAddress',
            args: [dnsName, 60n, elsewhere],
          }),
        ],
      ]), // 0
      call(recipient, 'setApprovalForAll', [operator, true]), // 1
    ],
  },
  {
    name: 'after edits',
    blockOverrides: at(636),
    calls: [
      resolveAddr(), // 0: explicit address wins
      resolveText('description'), // 1
      call(operator, 'setText', [dnsName, 'com.github', 'gskril']), // 2
      call(recipient, 'clearRecords', [dnsName]), // 3
    ],
  },
  {
    name: 'after clear',
    blockOverrides: at(648),
    calls: [
      resolveAddr(), // 0: back to the owner
      resolveText('description'), // 1: cleared
      call(recipient, 'setText', [
        toHex(packetToBytes(`sub.${name}`)),
        'a',
        'b',
      ]), // 2: subnames unsupported
      call(recipient, 'setAddress', [dnsName, 60n, '0x1234']), // 3: bad length
    ],
  },
]

const results = await simulateBlocks(client, {
  blocks: blocks.map(({ name: _, ...block }) => block) as never,
})

let failures = 0
const check = (description: string, pass: boolean, detail = '') => {
  if (!pass) failures++
  console.log(
    `${pass ? '✓' : '✗'} ${description}${detail ? ` (${detail})` : ''}`
  )
}
const decodeError = (result: { data?: Hex }) => {
  try {
    return decodeErrorResult({ abi, data: result.data! }).errorName
  } catch {
    return 'unknown'
  }
}
const resolvedAddress = (result: any) =>
  result.status === 'success'
    ? decodeAbiParameters([{ type: 'address' }], result.result[0])[0]
    : `failed: ${result.error?.shortMessage}`
const resolvedText = (result: any) =>
  result.status === 'success'
    ? decodeAbiParameters([{ type: 'string' }], result.result[0])[0]
    : `failed: ${result.error?.shortMessage}`
const ok = (result: any) => result.status === 'success'
const lower = (value: string) => value.toLowerCase()

check(
  'resolver deployed',
  ok(results[0].calls[0]) && results[0].calls[0].gasUsed < 30_000_000n
)
for (const [i, block] of results.entries()) {
  if (i > 2) break
  for (const result of block.calls as any[]) {
    check(`${blocks[i].name} succeeds`, ok(result), result.error?.shortMessage)
  }
}

const [, , , after, , edited, cleared] = results.map((b) => b.calls as any[])
check(
  'name resolves to the recipient with no records written',
  lower(resolvedAddress(after[0])) === lower(recipient),
  resolvedAddress(after[0])
)
check(
  'advertises name-based setters (ENS manager uses them)',
  ok(after[1]) && after[1].result === true
)
check('recipient can set their address (manager dry run)', ok(after[2]))
check(
  'gifter cannot write records',
  !ok(after[3]) && decodeError(after[3]) === 'Unauthorized'
)
check(
  'stranger cannot write records',
  !ok(after[4]) && decodeError(after[4]) === 'Unauthorized'
)
check('canModifyName is true for the recipient', after[5].result === true)
check(
  'ownerOf reads the ENSv2 .eth registry',
  lower(String(after[6].result)) === lower(recipient)
)
check(
  'recipient multicall edits succeed',
  ok(results[4].calls[0]) && ok(results[4].calls[1])
)
check(
  'explicitly set address takes precedence',
  lower(resolvedAddress(edited[0])) === lower(elsewhere),
  resolvedAddress(edited[0])
)
check(
  'text record resolves through the Universal Resolver',
  resolvedText(edited[1]) === 'gifted with ENS Fairy'
)
check('approved operator can write records', ok(edited[2]))
check('owner can clear records', ok(edited[3]))
check(
  'after clearing, the address falls back to the owner',
  lower(resolvedAddress(cleared[0])) === lower(recipient),
  resolvedAddress(cleared[0])
)
check('after clearing, text records are gone', resolvedText(cleared[1]) === '')
check(
  'subnames are rejected',
  !ok(cleared[2]) && decodeError(cleared[2]) === 'UnsupportedName'
)
check(
  'malformed ETH addresses are rejected',
  !ok(cleared[3]) && decodeError(cleared[3]) === 'InvalidEVMAddress'
)

const gas = (result: any) => result.gasUsed
console.log('\nGas (Sepolia):')
console.log(`  deploy FairyResolver (once): ${gas(results[0].calls[0])}`)
console.log(`  approve: ${gas(results[1].calls[0])}`)
console.log(`  commit: ${gas(results[1].calls[1])}`)
console.log(`  register: ${gas(results[2].calls[0])}`)

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll checks passed')
