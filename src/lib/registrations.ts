import { ethRegistrarNameRegisteredEventSnippet } from '@ensdomains/ensjs-abi/v2/ethRegistrar'
import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  http,
} from 'viem'

import { FAIRY_REFERRER } from './contracts'
import { getRegistrarAddress } from './gift'
import { type SupportedChainId, getChain } from './wagmi'

/**
 * Registrations made through the site, found by scanning the registrar's
 * NameRegistered logs for our referrer (an indexed topic, so the RPC filters).
 *
 * The scan follows the one in gskril/plainsafe: it walks backwards from the
 * finalized block so the newest registrations show up first, adapts its chunk
 * size to the RPC's range limits, and saves a checkpoint after every chunk so
 * a later visit only scans the blocks added since. Blocks above the finalized
 * one (the tip window) are re-fetched on every scan and never saved, so reorgs
 * need no bookkeeping.
 */

/** Blocks from the start of 2026-10-27 UTC, before the referrer shipped (#20) */
const FLOORS: Record<SupportedChainId, bigint> = {
  1: 26_280_314n,
  11155111: 12_001_423n,
}

/** A range most paid RPCs accept (Alchemy, QuickNode, dRPC); wider ones are tried after */
const INITIAL_CHUNK = 10_000n
const MAX_CHUNK = 1_000_000n
/** Without a `finalized` tag, stay this far behind the tip */
const FALLBACK_DEPTH = 96n
const STORAGE_VERSION = 1

export interface Registration {
  label: string
  owner: Address
  resolver: Address
  paymentToken: Address
  base: string
  premium: string
  duration: string
  blockNumber: string
  logIndex: number
  transactionHash: Hex
  /** Unix seconds, absent if the block header couldn't be read */
  timestamp?: string
}

interface Checkpoint {
  version: number
  /** The working chunk size is only valid for the RPC it was learned from */
  rpcUrl: string
  chunkSize: string
  /** Half the smallest range the RPC rejected, so growth stops short of it */
  chunkCeiling?: string
  /** Every block from scannedDownTo to finalizedHead has been scanned */
  finalizedHead?: string
  scannedDownTo?: string
  registrations: Registration[]
}

export interface ScanState {
  status: 'scanning' | 'done' | 'error'
  error?: string
  floor: bigint
  finalizedHead?: bigint
  scannedDownTo?: bigint
  /** Newest first, including the unsaved tip window */
  registrations: Registration[]
}

// ---------- RPC errors ----------

type LogErrorKind = 'range' | 'refused' | 'temporary'

interface ErrorInfo {
  code?: number
  status?: number
  message: string
}

/** viem nests the transport error several `cause`s deep */
function errorInfo(e: unknown): ErrorInfo {
  const chain: unknown[] = []
  for (let cur = e, i = 0; cur && i < 10; i++) {
    chain.push(cur)
    cur = (cur as { cause?: unknown }).cause
  }
  const find = (key: 'code' | 'status') =>
    chain
      .map((c) => (c as Record<string, unknown>)[key])
      .find((v): v is number => typeof v === 'number')
  const messages = chain.flatMap((c) => {
    const x = c as Record<string, unknown>
    return [x.details, x.shortMessage, x.message].filter(
      (m): m is string => typeof m === 'string'
    )
  })
  return {
    code: find('code'),
    status: find('status'),
    message: messages.join(' | ') || String(e),
  }
}

const RANGE =
  /block range|max(imum)? (block )?range|range (is )?too (large|wide|big)|ranges? over|limited to|exceed(s|ed)? .*(range|blocks|results)|too many (results|logs|blocks)|query returned more than|response size|log response/i
const REFUSED =
  /4444|pruned|history (is )?(not )?available|archive|not supported|method not found|not allowed|not whitelisted|does not exist|personal token|api key|unauthorized/i

/**
 * Range errors halve the chunk, refusals stop the scan, and anything else
 * (timeouts, 429s, odd errors) is retried.
 */
function classifyLogError(info: ErrorInfo): LogErrorKind {
  if (info.status === 429 || info.code === 429) return 'temporary'
  if (RANGE.test(info.message)) return 'range'
  if (REFUSED.test(info.message) || info.code === -32601) return 'refused'
  return 'temporary'
}

/** The RPC's own words when it sent any, else viem's summary */
export function shortMessage(e: unknown): string {
  const x = e as {
    details?: unknown
    shortMessage?: unknown
    message?: unknown
  }
  const m =
    typeof x?.details === 'string' && x.details
      ? x.details
      : typeof x?.shortMessage === 'string'
        ? x.shortMessage
        : typeof x?.message === 'string'
          ? x.message
          : String(e)
  return m.split('\n')[0].slice(0, 300)
}

class ScanError extends Error {}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

/**
 * Public RPCs fail intermittently, so temporary errors are retried for about
 * a minute: 1 s, 2 s, 4 s, then every 8 s.
 */
async function withRetry<T>(fn: () => Promise<T>, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    try {
      return await fn()
    } catch (e) {
      if (attempt >= 8 || classifyLogError(errorInfo(e)) !== 'temporary')
        throw e
      await sleep(Math.min(1000 * 2 ** attempt, 8000), signal)
    }
  }
}

// ---------- storage ----------

const storageKey = (chainId: number) => `ens-fairy:registrations:${chainId}`

function loadCheckpoint(chainId: number, rpcUrl: string): Checkpoint {
  const fresh: Checkpoint = {
    version: STORAGE_VERSION,
    rpcUrl,
    chunkSize: INITIAL_CHUNK.toString(),
    registrations: [],
  }
  try {
    const stored = JSON.parse(
      localStorage.getItem(storageKey(chainId)) ?? 'null'
    ) as Checkpoint | null
    if (stored?.version !== STORAGE_VERSION) return fresh
    return stored.rpcUrl === rpcUrl
      ? stored
      : {
          ...stored,
          rpcUrl,
          chunkSize: fresh.chunkSize,
          chunkCeiling: undefined,
        }
  } catch {
    return fresh
  }
}

function saveCheckpoint(chainId: number, cp: Checkpoint) {
  try {
    localStorage.setItem(storageKey(chainId), JSON.stringify(cp))
  } catch {
    // A full or blocked storage just means the next visit scans again
  }
}

export function clearCheckpoint(chainId: number) {
  localStorage.removeItem(storageKey(chainId))
}

const byNewest = (a: Registration, b: Registration) =>
  Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)) ||
  b.logIndex - a.logIndex

// ---------- scanning ----------

/** A client for the RPC the visitor entered, checked to be on `chainId` */
export async function connectRpc(rpcUrl: string, chainId: SupportedChainId) {
  const chain = getChain(chainId)
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 0 }),
  })
  const actual = await client.getChainId()
  if (actual !== chainId)
    throw new ScanError(`This RPC is for chain ${actual}, not ${chain.name}.`)
  return client as PublicClient
}

export async function scanRegistrations({
  client,
  chainId,
  rpcUrl,
  signal,
  onProgress,
}: {
  client: PublicClient
  chainId: SupportedChainId
  rpcUrl: string
  signal: AbortSignal
  onProgress: (state: ScanState) => void
}): Promise<ScanState> {
  const floor = FLOORS[chainId]
  const registrar = getRegistrarAddress(getChain(chainId))
  let cp = loadCheckpoint(chainId, rpcUrl)
  let tip: Registration[] = []

  const state = (status: ScanState['status'], error?: string): ScanState => ({
    status,
    error,
    floor,
    finalizedHead: cp.finalizedHead ? BigInt(cp.finalizedHead) : undefined,
    scannedDownTo: cp.scannedDownTo ? BigInt(cp.scannedDownTo) : undefined,
    registrations: [...tip, ...cp.registrations],
  })

  const commit = (next: Checkpoint) => {
    cp = next
    saveCheckpoint(chainId, cp)
    onProgress(state('scanning'))
  }

  const timestamps = new Map<bigint, string>()
  const timestampOf = async (block: bigint) => {
    if (!timestamps.has(block)) {
      try {
        const { timestamp } = await withRetry(
          () => client.getBlock({ blockNumber: block }),
          signal
        )
        timestamps.set(block, timestamp.toString())
      } catch {
        // Leave it undated rather than failing the scan
      }
    }
    return timestamps.get(block)
  }

  const getLogs = async (fromBlock: bigint, toBlock: bigint) => {
    const logs = await withRetry(
      () =>
        client.getLogs({
          address: registrar,
          event: ethRegistrarNameRegisteredEventSnippet,
          args: { referrer: FAIRY_REFERRER },
          fromBlock,
          toBlock,
        }),
      signal
    )
    const registrations: Registration[] = []
    for (const log of logs) {
      const { args } = log
      if (!args.label || !args.owner) continue
      // Some nodes include the block's timestamp in each log; others need a header read
      const blockTimestamp = (log as { blockTimestamp?: bigint | null })
        .blockTimestamp
      registrations.push({
        label: args.label,
        owner: args.owner,
        resolver: args.resolver!,
        paymentToken: args.paymentToken!,
        base: (args.base ?? 0n).toString(),
        premium: (args.premium ?? 0n).toString(),
        duration: (args.duration ?? 0n).toString(),
        blockNumber: log.blockNumber.toString(),
        logIndex: log.logIndex,
        transactionHash: log.transactionHash,
        timestamp:
          blockTimestamp != null
            ? blockTimestamp.toString()
            : await timestampOf(log.blockNumber),
      })
    }
    return registrations.sort(byNewest)
  }

  /**
   * Scans [from, to] in chunks going one way, halving the chunk on range
   * errors and doubling it after each success, and saves after every chunk.
   */
  const scanRange = async (
    direction: 'forward' | 'backward',
    from: bigint,
    to: bigint
  ) => {
    let lo = from
    let hi = to
    while (lo <= hi) {
      const size = BigInt(cp.chunkSize)
      const start =
        direction === 'backward' && hi - size + 1n > lo ? hi - size + 1n : lo
      const end =
        direction === 'forward' && lo + size - 1n < hi ? lo + size - 1n : hi
      let found: Registration[]
      try {
        found = await getLogs(start, end)
      } catch (e) {
        if (signal.aborted) throw e
        const kind = classifyLogError(errorInfo(e))
        if (kind === 'range' && size > 1n) {
          const half = (size / 2n).toString()
          cp = { ...cp, chunkSize: half, chunkCeiling: half }
          continue
        }
        throw new ScanError(
          kind === 'temporary'
            ? `Your RPC kept failing: ${shortMessage(e)}`
            : `Your RPC doesn't serve historical logs: ${shortMessage(e)}`
        )
      }
      const ceiling = cp.chunkCeiling ? BigInt(cp.chunkCeiling) : MAX_CHUNK
      const chunkSize = (size * 2n > ceiling ? ceiling : size * 2n).toString()
      if (direction === 'forward') {
        commit({
          ...cp,
          chunkSize,
          finalizedHead: end.toString(),
          registrations: [...found, ...cp.registrations],
        })
        lo = end + 1n
      } else {
        commit({
          ...cp,
          chunkSize,
          scannedDownTo: start.toString(),
          registrations: [...cp.registrations, ...found],
        })
        hi = start - 1n
      }
    }
  }

  try {
    const [latest, finalizedBlock] = await Promise.all([
      withRetry(() => client.getBlockNumber({ cacheTime: 0 }), signal),
      // Not every RPC supports the tag, so this one isn't retried
      client.getBlock({ blockTag: 'finalized' }).catch(() => undefined),
    ])
    const finalized =
      finalizedBlock?.number ??
      (latest > FALLBACK_DEPTH ? latest - FALLBACK_DEPTH : 0n)

    // A first scan starts at the finalized block, with nothing scanned yet
    const head = cp.finalizedHead ?? finalized.toString()
    cp = {
      ...cp,
      finalizedHead: head,
      scannedDownTo: cp.scannedDownTo ?? (BigInt(head) + 1n).toString(),
    }

    // 1. Forward: from the saved head up to the new finalized block
    await scanRange('forward', BigInt(head) + 1n, finalized)

    // 2. The tip window, above the finalized block: re-fetched, never saved
    if (latest > finalized) {
      try {
        tip = await getLogs(finalized + 1n, latest)
      } catch (e) {
        if (signal.aborted) throw e
        // The tip is small; a failure here shouldn't hide the saved history
      }
      onProgress(state('scanning'))
    }

    // 3. Backward: from below what's scanned down to the floor
    await scanRange('backward', floor, BigInt(cp.scannedDownTo!) - 1n)

    return state('done')
  } catch (e) {
    if (signal.aborted) return state('done')
    return state(
      'error',
      e instanceof ScanError ? e.message : `Your RPC failed: ${shortMessage(e)}`
    )
  }
}
