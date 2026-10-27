/**
 * Deploys FairyResolver, pointed at the chain's ENSv2 .eth registry.
 *
 *   DEPLOYER_KEY=0x... bun contracts/deploy.ts sepolia
 *   DEPLOYER_KEY=0x... bun contracts/deploy.ts mainnet
 *
 * Then set VITE_FAIRY_RESOLVER_<chainId> to the printed address and rebuild.
 */
import { addEnsContracts } from '@ensdomains/ensjs'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { type Hex, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet, sepolia } from 'viem/chains'

import artifact from './out/FairyResolver.json'

const network = process.argv[2]
if (network !== 'mainnet' && network !== 'sepolia') {
  console.error('Usage: bun contracts/deploy.ts <mainnet|sepolia>')
  process.exit(1)
}

const key = process.env.DEPLOYER_KEY as Hex | undefined
if (!key) {
  console.error('Set DEPLOYER_KEY')
  process.exit(1)
}

const chain = addEnsContracts(network === 'mainnet' ? mainnet : sepolia)
const transport = http(process.env.RPC_URL)
const publicClient = createPublicClient({ chain, transport })
const wallet = createWalletClient({
  account: privateKeyToAccount(key),
  chain,
  transport,
})

// ensjs calls the ENSv2 .eth registry `ensRegistry`
const ethRegistry = getChainContractAddress({ chain, contract: 'ensRegistry' })
console.log(
  `Deploying FairyResolver on ${chain.name} (.eth registry ${ethRegistry})`
)

const hash = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode as Hex,
  args: [ethRegistry],
})
console.log(`tx ${hash}`)

const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success' || !receipt.contractAddress) {
  console.error('Deployment failed')
  process.exit(1)
}

console.log(`\nFairyResolver: ${receipt.contractAddress}`)
console.log(`VITE_FAIRY_RESOLVER_${chain.id}=${receipt.contractAddress}`)
