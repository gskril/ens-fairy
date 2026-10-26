import { eacErrors } from '@ensdomains/ensjs-abi/v2/enhancedAccessControl'
import { ethRegistrarErrors } from '@ensdomains/ensjs-abi/v2/ethRegistrar'
import { permissionedResolverInitializeSnippet } from '@ensdomains/ensjs-abi/v2/permissionedResolver'
import { proxyDeployedEventSnippet } from '@ensdomains/ensjs-abi/v2/verifiableFactory'
import {
  type ChainWithContracts,
  getChainContractAddress,
} from '@ensdomains/ensjs/chain'
import { getRegisterPrice } from '@ensdomains/ensjs/public'
import {
  RESOLVER_ALL_ROLES,
  setAddressParameters,
} from '@ensdomains/ensjs/utils/v2'
import {
  commitNameWriteParameters,
  registerNameWriteParameters,
} from '@ensdomains/ensjs/wallet'
import {
  deployVerifiableProxy,
  deployVerifiableProxyWriteParameters,
} from '@ensdomains/ensjs/wallet/v2'
import {
  type Account,
  type Address,
  BaseError,
  type Client,
  ContractFunctionRevertedError,
  type Hex,
  type TransactionReceipt,
  type Transport,
  bytesToBigInt,
  decodeErrorResult,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  isAddressEqual,
  parseAbi,
  parseEventLogs,
} from 'viem'
import { toAccount } from 'viem/accounts'
import { call, getBlock, simulateBlocks } from 'viem/actions'

/** A chain with every ENS contract the gift flow touches. */
export type EnsChain = ChainWithContracts<
  | 'ensEthRegistrar'
  | 'ensVerifiableFactory'
  | 'ensPermissionedResolverImpl'
  | 'ensUniversalResolver'
  | 'ensUniversalHelper'
  | 'usdc'
  | 'dai'
>

export const SECONDS_PER_YEAR = 31_536_000

export const PAYMENT_TOKENS = {
  usdc: { symbol: 'USDC', decimals: 6 },
  dai: { symbol: 'DAI', decimals: 18 },
} as const

export type PaymentToken = keyof typeof PAYMENT_TOKENS

export function getPaymentTokenAddress(chain: EnsChain, token: PaymentToken) {
  return getChainContractAddress({ chain, contract: token })
}

export function getRegistrarAddress(chain: EnsChain) {
  return getChainContractAddress({ chain, contract: 'ensEthRegistrar' })
}

export function formatTokenAmount(amount: bigint, token: PaymentToken) {
  const value = Number(formatUnits(amount, PAYMENT_TOKENS[token].decimals))
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const randomSalt = () =>
  bytesToBigInt(crypto.getRandomValues(new Uint8Array(32)))

export function yearsToSeconds(years: number) {
  return Math.round(years * SECONDS_PER_YEAR)
}

export async function getGiftPrice(
  client: Client<Transport, EnsChain>,
  { label, years, token }: { label: string; years: number; token: PaymentToken }
) {
  const { base, premium } = await getRegisterPrice(client, {
    label,
    duration: BigInt(yearsToSeconds(years)),
    paymentToken: getPaymentTokenAddress(client.chain, token),
  })

  return { base, premium, total: base + premium }
}

/**
 * Calldata that initializes a PermissionedResolver proxy for the recipient.
 *
 * The recipient is granted every resolver role, so they fully control their
 * records from day one. The ETH address record is written during
 * initialization (when role checks are skipped), which means the name
 * resolves to the recipient as soon as it's registered. The person paying
 * gets no roles on the resolver.
 */
export function encodeResolverInit({
  name,
  recipient,
}: {
  name: string
  recipient: Address
}) {
  return encodeFunctionData({
    abi: permissionedResolverInitializeSnippet,
    functionName: 'initialize',
    args: [
      [{ account: recipient, roleBitmap: RESOLVER_ALL_ROLES }],
      [
        encodeFunctionData(
          setAddressParameters({ name, coin: 60, value: recipient })
        ),
      ],
    ],
  })
}

type ResolverDeployParameters = {
  name: string
  recipient: Address
  salt: bigint
}

function resolverDeployArgs(
  chain: EnsChain,
  { name, recipient, salt }: ResolverDeployParameters
) {
  return {
    factoryAddress: getChainContractAddress({
      chain,
      contract: 'ensVerifiableFactory',
    }),
    implAddress: getChainContractAddress({
      chain,
      contract: 'ensPermissionedResolverImpl',
    }),
    callData: encodeResolverInit({ name, recipient }),
    salt,
  }
}

export function deployRecipientResolver(
  wallet: Client<Transport, EnsChain, Account>,
  params: ResolverDeployParameters
) {
  return deployVerifiableProxy(wallet, resolverDeployArgs(wallet.chain, params))
}

/** Finds the resolver proxy address in the deploy transaction's logs. */
export function getDeployedResolver(
  receipt: TransactionReceipt,
  { chain, sender }: { chain: EnsChain; sender: Address }
) {
  const factory = getChainContractAddress({
    chain,
    contract: 'ensVerifiableFactory',
  })

  const [event] = parseEventLogs({
    abi: proxyDeployedEventSnippet,
    eventName: 'ProxyDeployed',
    logs: receipt.logs.filter((log) => isAddressEqual(log.address, factory)),
    args: { sender },
  })

  if (!event) throw new Error('Resolver deployment not found in transaction')
  return event.args.proxyAddress
}

export type RegistrationParams = {
  label: string
  owner: Address
  duration: number
  secret: Hex
  resolverAddress: Address
  paymentToken: Address
}

export function getRegisterWriteParameters(
  wallet: Client<Transport, EnsChain, Account>,
  params: RegistrationParams
) {
  return registerNameWriteParameters(wallet, params)
}

/**
 * Replays the whole gift (resolver, approval, commit, and a register after the
 * waiting period) against current chain state with `eth_simulateV1`, so a gift
 * that would fail is caught before any gas is spent. Resolves to the first
 * failing call's error, or `undefined` if everything succeeds. Throws if the
 * RPC doesn't support simulation.
 */
export async function dryRunGift(
  client: Client<Transport, EnsChain>,
  {
    account,
    label,
    recipient,
    years,
    token,
    secret,
    salt,
  }: {
    account: Address
    label: string
    recipient: Address
    years: number
    token: PaymentToken
    secret: Hex
    salt: bigint
  }
) {
  const chain = client.chain
  // Write-parameter builders only read `chain` and `account` from the client
  const sender = {
    ...client,
    account: toAccount(account),
  } as Client<Transport, EnsChain, Account>
  const name = `${label}.eth`
  const paymentToken = getPaymentTokenAddress(chain, token)
  const registrar = getRegistrarAddress(chain)

  const deploy = deployVerifiableProxyWriteParameters(
    sender,
    resolverDeployArgs(chain, { name, recipient, salt })
  )
  const deployData = encodeFunctionData({
    abi: deploy.abi,
    functionName: deploy.functionName,
    args: deploy.args,
  })

  // The proxy address is deterministic for (sender, salt)
  const { data } = await call(client, {
    account,
    to: deploy.address,
    data: deployData,
  })
  if (!data) throw new Error('Could not predict resolver address')
  const resolverAddress = decodeFunctionResult({
    abi: deploy.abi,
    functionName: deploy.functionName,
    data,
  })

  const registration = {
    label,
    owner: recipient,
    duration: yearsToSeconds(years),
    secret,
    resolverAddress,
  }
  const commit = commitNameWriteParameters(sender, registration)
  const register = registerNameWriteParameters(sender, {
    ...registration,
    paymentToken,
  })
  const { total } = await getGiftPrice(client, { label, years, token })
  const { timestamp } = await getBlock(client)

  const blocks = await simulateBlocks(client, {
    blocks: [
      {
        calls: [
          { account, to: deploy.address, data: deployData },
          {
            account,
            to: paymentToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [registrar, total],
          },
          {
            account,
            to: commit.address,
            abi: commit.abi,
            functionName: commit.functionName,
            args: commit.args,
          },
        ],
      },
      {
        blockOverrides: { time: timestamp + 600n },
        calls: [
          {
            account,
            to: register.address,
            abi: register.abi,
            functionName: register.functionName,
            args: register.args,
          },
        ],
      },
    ],
  })

  for (const block of blocks) {
    for (const result of block.calls) {
      if (result.status === 'failure') return result.error
    }
  }

  return undefined
}

/** Errors that can bubble up from contracts the registrar calls into */
const knownErrors = [
  ...ethRegistrarErrors,
  ...eacErrors,
  ...parseAbi([
    'error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)',
    'error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)',
  ]),
]

/** Returns the decoded custom error name and args from a contract revert. */
export function getRevertError(err: unknown) {
  if (!(err instanceof BaseError)) return undefined
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
  if (!(revert instanceof ContractFunctionRevertedError)) return undefined
  if (revert.data) {
    return { name: revert.data.errorName, args: revert.data.args ?? [] }
  }
  if (!revert.raw) return undefined
  try {
    const decoded = decodeErrorResult({ abi: knownErrors, data: revert.raw })
    return { name: decoded.errorName, args: decoded.args ?? [] }
  } catch {
    return undefined
  }
}

export function getErrorMessage(err: unknown) {
  const revert = getRevertError(err)
  if (revert) {
    switch (revert.name) {
      case 'NameNotAvailable':
        return 'This name was just registered by someone else'
      case 'CommitmentTooOld':
        return 'Your reservation expired, please start again'
      case 'PaymentTokenNotSupported':
        return 'That payment token is not supported'
      case 'SafeERC20FailedOperation':
        return 'Token transfer failed. Check your balance and approval'
      case 'ERC20InsufficientBalance':
        return 'Not enough tokens to pay for this name'
      case 'ERC20InsufficientAllowance':
        return 'Token approval is too low, please try again'
      case 'EACUnauthorizedAccountRoles':
        return "The ENS registrar isn't accepting registrations on this network yet"
      default:
        return `Transaction would fail (${revert.name})`
    }
  }

  if (err instanceof BaseError) {
    if (err.walk((e) => (e as { code?: number }).code === 4001)) {
      return 'Transaction rejected'
    }
    return err.shortMessage
  }

  return err instanceof Error ? err.message : 'Something went wrong'
}
