import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { getEnsName } from 'viem/actions'
import { cx, style } from 'zyzz'

import { shortenAddress } from './components/Avatar'
import { Nav } from './components/Nav'
import { Button, Input, Spinner } from './components/ui'
import { useEnsClient } from './hooks/useEnsClient'
import {
  PAYMENT_TOKENS,
  type PaymentToken,
  SECONDS_PER_YEAR,
  formatTokenAmount,
  getPaymentTokenAddress,
} from './lib/gift'
import {
  type Registration,
  type ScanState,
  clearCheckpoint,
  connectRpc,
  scanRegistrations,
  shortMessage,
} from './lib/registrations'
import {
  type SupportedChainId,
  explorerUrl,
  getChain,
  isSupportedChain,
  mainnet,
  sepolia,
} from './lib/wagmi'

const NETWORKS = [
  { chainId: mainnet.id, label: 'Mainnet' },
  { chainId: sepolia.id, label: 'Sepolia' },
] as const

const CHAIN_KEY = 'ens-fairy:admin-chain'
const rpcKey = (chainId: number) => `ens-fairy:admin-rpc:${chainId}`

function read(key: string) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function savedChain(): SupportedChainId {
  const chainId = Number(read(CHAIN_KEY))
  return isSupportedChain(chainId) ? chainId : mainnet.id
}

/** A timeline of names registered through the site, read from any RPC with log history */
export function Admin() {
  const [chainId, setChainId] = useState(savedChain)
  const [rpcInput, setRpcInput] = useState(() => read(rpcKey(chainId)))
  const [scan, setScan] = useState<ScanState>()
  const [connectError, setConnectError] = useState<string>()
  const [running, setRunning] = useState(false)
  const abort = useRef<AbortController>(undefined)

  useEffect(() => {
    document.title = 'Registrations · ENS Fairy'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    return () => robots.remove()
  }, [])

  // Pick up where the last visit to this network left off
  useEffect(() => {
    const rpcUrl = read(rpcKey(chainId))
    setRpcInput(rpcUrl)
    setScan(undefined)
    setConnectError(undefined)
    if (rpcUrl) run(rpcUrl)
    else stop()
    return () => abort.current?.abort()
  }, [chainId])

  function selectNetwork(next: SupportedChainId) {
    localStorage.setItem(CHAIN_KEY, String(next))
    setChainId(next)
  }

  async function run(rpcUrl: string, fresh = false) {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setRunning(true)
    setConnectError(undefined)

    try {
      const client = await connectRpc(rpcUrl, chainId)
      if (controller.signal.aborted) return
      localStorage.setItem(rpcKey(chainId), rpcUrl)
      if (fresh) clearCheckpoint(chainId)
      const result = await scanRegistrations({
        client,
        chainId,
        rpcUrl,
        signal: controller.signal,
        onProgress: (state) => {
          if (!controller.signal.aborted) setScan(state)
        },
      })
      if (!controller.signal.aborted) setScan(result)
    } catch (e) {
      if (controller.signal.aborted) return
      setConnectError(shortMessage(e))
      setScan(undefined)
    } finally {
      if (abort.current === controller) setRunning(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const url = rpcInput.trim()
    if (url) run(url)
  }

  function stop() {
    abort.current?.abort()
    setRunning(false)
  }

  const registrations = scan?.registrations ?? []

  return (
    <div {...styles.layout()}>
      <Nav>
        <div role="radiogroup" aria-label="Network" {...styles.networks()}>
          {NETWORKS.map((network) => (
            <button
              key={network.chainId}
              type="button"
              role="radio"
              aria-checked={chainId === network.chainId}
              onClick={() => selectNetwork(network.chainId)}
              {...cx(
                styles.network(),
                chainId === network.chainId && styles.networkActive()
              )}
            >
              {network.label}
            </button>
          ))}
        </div>
      </Nav>

      <main {...styles.main()}>
        <header {...styles.header()}>
          <h1 {...styles.title()}>Registrations</h1>
          <p {...styles.subtitle()}>
            Names gifted through ENS Fairy, newest first.
          </p>
        </header>

        <form onSubmit={handleSubmit} {...styles.card()}>
          <Input
            label="RPC URL"
            type="url"
            placeholder={
              chainId === mainnet.id
                ? 'https://eth-mainnet.g.alchemy.com/v2/…'
                : 'https://eth-sepolia.g.alchemy.com/v2/…'
            }
            value={rpcInput}
            error={connectError}
            hint="It needs eth_getLogs history, and is saved in this browser only."
            onChange={(e) => setRpcInput(e.target.value)}
          />
          <div {...styles.actions()}>
            {running ? (
              <Button tone="secondary" onClick={stop}>
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!rpcInput.trim()}>
                Scan
              </Button>
            )}
            {scan && !running && (
              <Button
                tone="ghost"
                onClick={() => run(rpcInput.trim(), true)}
                disabled={!rpcInput.trim()}
              >
                Rescan from scratch
              </Button>
            )}
          </div>
        </form>

        {scan && (
          <>
            <Summary
              chainId={chainId}
              scan={scan}
              running={running}
              registrations={registrations}
            />
            {registrations.length > 0 ? (
              <Timeline chainId={chainId} registrations={registrations} />
            ) : (
              !running && (
                <p {...styles.empty()}>
                  No registrations through the site yet.
                </p>
              )
            )}
          </>
        )}
      </main>
    </div>
  )
}

function tokenOf(chainId: SupportedChainId, address: Address) {
  return (Object.keys(PAYMENT_TOKENS) as PaymentToken[]).find(
    (t) =>
      getPaymentTokenAddress(getChain(chainId), t).toLowerCase() ===
      address.toLowerCase()
  )
}

function Summary({
  chainId,
  scan,
  running,
  registrations,
}: {
  chainId: SupportedChainId
  scan: ScanState
  running: boolean
  registrations: Registration[]
}) {
  const totals = new Map<PaymentToken, bigint>()
  for (const r of registrations) {
    const token = tokenOf(chainId, r.paymentToken)
    if (!token) continue
    totals.set(
      token,
      (totals.get(token) ?? 0n) + BigInt(r.base) + BigInt(r.premium)
    )
  }

  const { finalizedHead, scannedDownTo, floor } = scan
  const total = finalizedHead !== undefined ? finalizedHead - floor + 1n : 0n
  const done =
    finalizedHead !== undefined && scannedDownTo !== undefined
      ? finalizedHead - scannedDownTo + 1n
      : 0n
  const percent = total > 0n ? Number((done * 100n) / total) : 0

  return (
    <div {...styles.summary()}>
      <div {...styles.stats()}>
        <Stat label="Names" value={registrations.length.toLocaleString()} />
        {[...totals].map(([token, amount]) => (
          <Stat
            key={token}
            label={`Spent in ${PAYMENT_TOKENS[token].symbol}`}
            value={formatTokenAmount(amount, token)}
          />
        ))}
      </div>
      <div
        role="status"
        {...(scan.status === 'error' ? styles.statusError() : styles.status())}
      >
        {running && <Spinner size={12} />}
        {scan.status === 'error'
          ? scan.error
          : running
            ? `Scanning… ${percent}% of blocks since ${floor.toLocaleString()}`
            : scan.status === 'done' && percent === 100
              ? `Up to date as of block ${finalizedHead?.toLocaleString()}`
              : `Stopped at ${percent}% of blocks since ${floor.toLocaleString()}`}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div {...styles.stat()}>
      <span {...styles.statLabel()}>{label}</span>
      <span {...styles.statValue()}>{value}</span>
    </div>
  )
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function Timeline({
  chainId,
  registrations,
}: {
  chainId: SupportedChainId
  registrations: Registration[]
}) {
  const days: { day: string; items: Registration[] }[] = []
  for (const r of registrations) {
    const day = r.timestamp
      ? dayFormat.format(new Date(Number(r.timestamp) * 1000))
      : 'Undated'
    const last = days.at(-1)
    if (last?.day === day) last.items.push(r)
    else days.push({ day, items: [r] })
  }

  return (
    <div {...styles.timeline()}>
      {days.map(({ day, items }) => (
        <section key={day} {...styles.day()}>
          <h2 {...styles.dayLabel()}>
            {day}
            <span {...styles.dayCount()}>{items.length}</span>
          </h2>
          <ol {...styles.list()}>
            {items.map((r) => (
              <Row
                key={`${r.transactionHash}:${r.logIndex}`}
                chainId={chainId}
                registration={r}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function Row({
  chainId,
  registration: r,
}: {
  chainId: SupportedChainId
  registration: Registration
}) {
  const explorer = explorerUrl(chainId)
  const ensApp =
    chainId === mainnet.id
      ? 'https://app.ens.domains'
      : 'https://sepolia.app.ens.domains'
  const token = tokenOf(chainId, r.paymentToken)
  const cost = BigInt(r.base) + BigInt(r.premium)
  // Registrar durations use 365.25-day years, so compare the rounded figure
  const years = (Number(r.duration) / SECONDS_PER_YEAR).toLocaleString(
    undefined,
    { maximumFractionDigits: 2 }
  )

  return (
    <li {...styles.row()}>
      <span {...styles.time()}>
        {r.timestamp
          ? timeFormat.format(new Date(Number(r.timestamp) * 1000))
          : '—'}
      </span>
      <div {...styles.rowMain()}>
        <a
          href={`${ensApp}/${r.label}.eth`}
          target="_blank"
          rel="noreferrer"
          {...styles.name()}
        >
          {r.label}.eth
        </a>
        <span {...styles.meta()}>
          to{' '}
          <a
            href={`${explorer}/address/${r.owner}`}
            target="_blank"
            rel="noreferrer"
            {...styles.link()}
          >
            <OwnerName chainId={chainId} address={r.owner} />
          </a>{' '}
          · {years} {years === '1' ? 'year' : 'years'}
        </span>
      </div>
      <div {...styles.rowEnd()}>
        <span {...styles.cost()}>
          {token
            ? `${formatTokenAmount(cost, token)} ${PAYMENT_TOKENS[token].symbol}`
            : cost.toString()}
        </span>
        <a
          href={`${explorer}/tx/${r.transactionHash}`}
          target="_blank"
          rel="noreferrer"
          {...styles.link()}
        >
          Tx ↗
        </a>
      </div>
    </li>
  )
}

/** The owner's primary name, read through the site's own RPC */
function OwnerName({
  chainId,
  address,
}: {
  chainId: SupportedChainId
  address: Address
}) {
  const client = useEnsClient(chainId)
  const { data: name } = useQuery({
    queryKey: ['primary-name', chainId, address],
    queryFn: () => getEnsName(client, { address }),
    staleTime: Infinity,
  })

  return <>{name ?? shortenAddress(address)}</>
}

namespace styles {
  export const networks = style({
    display: 'inline-flex',
    padding: '0.25rem',
    gap: '0.25rem',
    borderRadius: '0.625rem',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
  })

  export const network = style({
    padding: '0.375rem 0.75rem',
    border: 'none',
    borderRadius: '0.4375rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    ':hover': { color: 'var(--text)' },
  })

  export const networkActive = style({
    backgroundColor: 'var(--blue-light)',
    color: 'var(--blue)',
    ':hover': { color: 'var(--blue)' },
  })

  export const layout = style({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3rem',
    minHeight: '100svh',
    padding: '1rem',
    '@media (min-width: 640px)': { padding: '2rem' },
  })

  export const main = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    width: '100%',
    maxWidth: '48rem',
  })

  export const header = style({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'center',
  })

  export const title = style({
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 500,
    letterSpacing: '-0.03em',
    lineHeight: 0.96,
    '@media (min-width: 640px)': { fontSize: '3.5rem' },
  })

  export const subtitle = style({
    margin: 0,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: '1.1875rem',
    lineHeight: 1.35,
  })

  export const card = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--surface)',
    '@media (min-width: 640px)': { padding: '1.5rem' },
  })

  export const actions = style({
    display: 'grid',
    gap: '0.5rem',
    '@media (min-width: 640px)': { gridAutoFlow: 'column' },
  })

  export const summary = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  })

  export const stats = style({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
    gap: '0.75rem',
  })

  export const stat = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.875rem 1rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--surface)',
  })

  export const statLabel = style({
    fontWeight: 500,
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  })

  export const statValue = style({
    fontFamily: 'var(--font-mono)',
    fontSize: '1.375rem',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  })

  export const status = style({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    paddingLeft: '0.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  })

  export const statusError = style({
    paddingLeft: '0.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--error-text)',
    overflowWrap: 'anywhere',
  })

  export const empty = style({
    margin: 0,
    padding: '2rem 1rem',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: '1.0625rem',
  })

  export const timeline = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  })

  export const day = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  })

  export const dayLabel = style({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
    paddingLeft: '0.25rem',
    fontWeight: 500,
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  })

  export const dayCount = style({
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    backgroundColor: 'var(--blue-light)',
    color: 'var(--blue)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: 0,
  })

  export const list = style({
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    padding: 0,
    listStyle: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--surface)',
    overflow: 'hidden',
  })

  export const row = style({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '0.25rem 0.75rem',
    padding: '0.875rem 1rem',
    '@media (min-width: 640px)': {
      gridTemplateColumns: '4.5rem minmax(0, 1fr) auto',
    },
    ':not(:last-child)': { borderBottom: '1px solid var(--border)' },
  })

  // Its own line on phones, a column from 640px up
  export const time = style({
    gridColumn: '1 / -1',
    '@media (min-width: 640px)': { gridColumn: 'auto' },
    color: 'var(--text-tertiary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    fontVariantNumeric: 'tabular-nums',
  })

  export const rowMain = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minWidth: 0,
  })

  export const name = style({
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    overflowWrap: 'anywhere',
    ':hover': { color: 'var(--blue)' },
  })

  export const meta = style({
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    overflowWrap: 'anywhere',
  })

  export const link = style({
    color: 'var(--text-secondary)',
    fontWeight: 500,
    ':hover': { color: 'var(--blue)' },
  })

  export const rowEnd = style({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.125rem',
    fontSize: '0.875rem',
  })

  export const cost = style({
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  })
}
