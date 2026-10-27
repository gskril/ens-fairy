import confetti from 'canvas-confetti'
import { type ReactNode, useEffect, useState } from 'react'
import { cx, style, variants } from 'zyzz'

import {
  type GiftParams,
  type GiftState,
  type StepId,
  stepStatus,
  useGiftFlow,
} from '../hooks/useGiftFlow'
import { PAYMENT_TOKENS, formatTokenAmount } from '../lib/gift'
import { explorerUrl } from '../lib/wagmi'
import { Avatar, shortenAddress } from './Avatar'
import { Dialog } from './Dialog'
import { Button, Spinner } from './ui'

// ENS Blue, Light Blue, Magenta, Green, Yellow
const CONFETTI_COLORS = ['#0080BC', '#CEE1E8', '#F53293', '#007C23', '#FFF72F']

type GiftDialogProps = {
  open: boolean
  onClose: () => void
  /** Called after a successful gift, when the user wants to start over */
  onComplete: () => void
  params: GiftParams | undefined
  recipientName?: string
  price?: bigint
}

export function GiftDialog({
  open,
  onClose,
  onComplete,
  params,
  recipientName,
  price,
}: GiftDialogProps) {
  const { state, start, register, retry } = useGiftFlow(params)
  const isDone = state.phase === 'done'

  useEffect(() => {
    if (!isDone) return
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.6 },
      colors: CONFETTI_COLORS,
      zIndex: 1000,
    })
  }, [isDone])

  if (!params) return null
  const name = `${params.label}.eth`
  const symbol = PAYMENT_TOKENS[params.token].symbol

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isDone ? `Gifted ${name}` : `Gift ${name}`}
      description={
        isDone
          ? 'The name is theirs, and it already points to their address. They can update its records any time.'
          : 'Gifting takes a few transactions, with a one minute wait to protect the name from being sniped.'
      }
    >
      <dl {...styles.summary()}>
        <Detail label="Name">
          <span {...styles.namePill()}>{name}</span>
        </Detail>
        <Detail label="Duration">
          {params.years} {params.years === 1 ? 'year' : 'years'}
        </Detail>
        <Detail label="Recipient">
          <a
            href={`${explorerUrl(params.chainId)}/address/${params.recipient}`}
            target="_blank"
            rel="noreferrer"
            {...styles.recipient()}
          >
            <span {...styles.recipientText()}>
              {recipientName && <span {...styles.mono()}>{recipientName}</span>}
              <span
                {...(recipientName ? styles.secondaryText() : styles.mono())}
              >
                {shortenAddress(params.recipient)}
              </span>
            </span>
            {recipientName && (
              <Avatar name={recipientName} chainId={params.chainId} />
            )}
          </a>
        </Detail>
        {price !== undefined && (
          <Detail label="Price">
            <span {...styles.mono()}>
              {formatTokenAmount(price, params.token)} {symbol}
            </span>
          </Detail>
        )}
      </dl>

      {state.phase !== 'idle' && (
        <Steps state={state} params={params} symbol={symbol} />
      )}

      {state.error && (
        <p role="alert" {...styles.error()}>
          {state.error}
        </p>
      )}

      <Action
        state={state}
        onStart={start}
        onRegister={register}
        onRetry={retry}
        onComplete={onComplete}
        name={name}
        chainId={params.chainId}
      />
    </Dialog>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div {...styles.detail()}>
      <dt {...styles.detailLabel()}>{label}</dt>
      <dd {...styles.detailValue()}>{children}</dd>
    </div>
  )
}

const STEPS: { id: StepId; title: (symbol: string) => string }[] = [
  { id: 'approve', title: (symbol) => `Approve ${symbol}` },
  { id: 'commit', title: () => 'Reserve the name' },
  { id: 'wait', title: () => 'Wait a minute' },
  { id: 'register', title: () => 'Complete registration' },
]

/** With a wallet batch, approval and commit are one confirmation */
const BATCHED_STEPS: typeof STEPS = [
  { id: 'commit', title: () => 'Reserve the name' },
  { id: 'wait', title: () => 'Wait a minute' },
  { id: 'register', title: () => 'Complete registration' },
]

function Steps({
  state,
  params,
  symbol,
}: {
  state: GiftState
  params: GiftParams
  symbol: string
}) {
  return (
    <ol {...styles.steps()}>
      {(state.batched ? BATCHED_STEPS : STEPS).map((step, i) => {
        const status = stepStatus(state, step.id)
        const hash = state.hashes[step.id]

        return (
          <li key={step.id} {...styles.step({ status })}>
            <StepIcon status={status} index={i + 1} />
            <span {...styles.stepTitle()}>{step.title(symbol)}</span>
            <span {...styles.stepMeta()}>
              {status === 'skipped' && 'Already approved'}
              {status === 'active' && step.id === 'wait' && (
                <Countdown readyAt={state.readyAt} ready={state.ready} />
              )}
              {status === 'active' &&
                state.txStatus === 'sign' &&
                'Confirm in wallet'}
              {status === 'active' &&
                state.txStatus === 'confirm' &&
                !hash &&
                'Confirming…'}
              {status === 'active' && state.txStatus === 'confirm' && hash && (
                <a
                  href={`${explorerUrl(params.chainId)}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  {...styles.link()}
                >
                  Confirming…
                </a>
              )}
              {status === 'done' && hash && (
                <a
                  href={`${explorerUrl(params.chainId)}/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  {...styles.link()}
                >
                  View
                </a>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function StepIcon({
  status,
  index,
}: {
  status: ReturnType<typeof stepStatus>
  index: number
}) {
  if (status === 'done' || status === 'skipped') {
    return (
      <span {...cx(styles.icon(), styles.iconDone())}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.5 4.5 9 10 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span {...cx(styles.icon(), styles.iconActive())}>
        <Spinner size={14} />
      </span>
    )
  }
  if (status === 'error') {
    return <span {...cx(styles.icon(), styles.iconError())}>!</span>
  }
  return <span {...styles.icon()}>{index}</span>
}

function Countdown({ readyAt, ready }: { readyAt?: number; ready?: boolean }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (ready) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [ready])

  if (ready) return <>Ready</>
  if (!readyAt) return <>Checking…</>
  const seconds = Math.max(0, Math.ceil((readyAt - now) / 1000))
  return <>{seconds > 0 ? `${seconds}s` : 'Almost…'}</>
}

function Action({
  state,
  onStart,
  onRegister,
  onRetry,
  onComplete,
  name,
  chainId,
}: {
  state: GiftState
  onStart: () => void
  onRegister: () => void
  onRetry: () => void
  onComplete: () => void
  name: string
  chainId: number
}) {
  if (state.error) {
    return <Button onClick={onRetry}>Try again</Button>
  }

  switch (state.phase) {
    case 'idle':
      return (
        <Button onClick={onStart} loading={state.checking}>
          {state.checking ? 'Checking' : 'Start'}
        </Button>
      )
    case 'wait':
      if (state.ready) {
        return <Button onClick={onRegister}>Register {name}</Button>
      }
      // Resumed after a reload: re-check the commit and keep going
      if (!state.readyAt && !state.txStatus) {
        return <Button onClick={onStart}>Continue</Button>
      }
      return <Button disabled>Waiting…</Button>
    case 'done':
      return (
        <div {...styles.actions()}>
          <Button
            tone="secondary"
            onClick={() =>
              window.open(
                `https://${chainId === 1 ? '' : 'sepolia.'}app.ens.domains/${name}`,
                '_blank'
              )
            }
          >
            View name
          </Button>
          <Button onClick={onComplete}>Gift another</Button>
        </div>
      )
    default:
      return (
        <Button loading>
          {state.txStatus === 'sign' ? 'Confirm in wallet' : 'Processing'}
        </Button>
      )
  }
}

namespace styles {
  export const summary = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    margin: 0,
  })

  export const detail = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    minHeight: '3.5rem',
    padding: '0.75rem 1rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  })

  export const detailLabel = style({
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  })

  export const mono = style({ fontFamily: 'var(--font-mono)' })

  // Names as the brand presents them: mono on a light tint
  export const namePill = style({
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--blue-light)',
    color: 'var(--blue)',
    fontFamily: 'var(--font-mono)',
  })

  export const detailValue = style({
    margin: 0,
    minWidth: 0,
    fontWeight: 500,
    textAlign: 'right',
    overflowWrap: 'anywhere',
  })

  export const recipient = style({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  })

  export const recipientText = style({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  })

  export const secondaryText = style({
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 400,
    fontSize: '0.8125rem',
  })

  export const steps = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    margin: 0,
    padding: '0.5rem',
    listStyle: 'none',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--surface-secondary)',
  })

  export const step = variants({
    base: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem',
      borderRadius: '0.75rem',
      fontWeight: 500,
      transitionProperty: 'background-color, color',
      transitionDuration: '200ms',
    },
    defaultVariants: { status: 'pending' },
    variants: {
      status: {
        pending: { color: 'var(--text-secondary)' },
        active: {
          backgroundColor: 'var(--surface)',
          color: 'var(--text)',
          boxShadow: 'inset 0 0 0 1px var(--border)',
        },
        done: { color: 'var(--text)' },
        skipped: { color: 'var(--text-secondary)' },
        error: {
          backgroundColor: 'var(--surface)',
          color: 'var(--error-text)',
        },
      },
    },
  })

  export const icon = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    fontSize: '0.75rem',
    fontWeight: 500,
  })

  export const iconDone = style({
    borderColor: 'transparent',
    backgroundColor: 'var(--green)',
    color: 'white',
  })

  export const iconActive = style({
    borderColor: 'transparent',
    color: 'var(--blue)',
  })

  export const iconError = style({
    borderColor: 'transparent',
    backgroundColor: 'var(--error)',
    color: 'white',
  })

  export const stepTitle = style({ flex: 1 })

  export const stepMeta = style({
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  })

  export const link = style({
    color: 'var(--blue)',
    fontWeight: 500,
    ':hover': { textDecoration: 'underline' },
  })

  export const error = style({
    margin: 0,
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--error-light)',
    color: 'var(--text)',
    fontWeight: 500,
    textAlign: 'center',
  })

  export const actions = style({
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
  })
}
