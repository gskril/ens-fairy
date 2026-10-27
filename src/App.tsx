import { type FormEvent, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useConnection, useSwitchChain } from 'wagmi'
import { cx, style } from 'zyzz'

import { GiftDialog } from './components/GiftDialog'
import { Nav } from './components/Nav'
import { TestnetFaucet } from './components/TestnetFaucet'
import { WalletModal } from './components/WalletModal'
import { GithubIcon } from './components/icons'
import { Button, Input, Spinner } from './components/ui'
import type { GiftParams } from './hooks/useGiftFlow'
import { useName } from './hooks/useName'
import { useRecipient } from './hooks/useRecipient'
import {
  PAYMENT_TOKENS,
  type PaymentToken,
  formatTokenAmount,
} from './lib/gift'
import { isSupportedChain, mainnet, sepolia } from './lib/wagmi'

export function App() {
  const { isConnected, chainId: walletChainId } = useConnection()
  const { mutate: switchChain, isPending: isSwitching } = useSwitchChain()
  const chainId = isSupportedChain(walletChainId) ? walletChainId : mainnet.id
  const unsupportedChain = isConnected && !isSupportedChain(walletChainId)

  const [nameInput, setNameInput] = useState('')
  const [recipientInput, setRecipientInput] = useState('')
  const [yearsInput, setYearsInput] = useState('1')
  const [token, setToken] = useState<PaymentToken>('usdc')
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [gift, setGift] = useState<{
    params: GiftParams
    recipientName?: string
    price?: bigint
  }>()
  const [giftOpen, setGiftOpen] = useState(false)

  const years = Number(yearsInput)
  const invalidYears =
    yearsInput !== '' && (!Number.isInteger(years) || years < 1 || years > 100)

  const name = useName({
    input: nameInput,
    years: invalidYears ? 0 : years,
    token,
    chainId,
  })
  const recipient = useRecipient({ input: recipientInput, chainId })

  const nameError =
    name.error ??
    (name.label && name.isAvailable === false ? 'Not available' : undefined)

  const canSubmit =
    !!name.label &&
    name.isAvailable === true &&
    !name.isTyping &&
    !!recipient.recipient &&
    !recipient.isLoading &&
    !invalidYears &&
    years > 0

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!isConnected) {
      setWalletModalOpen(true)
      return
    }

    if (!canSubmit || !name.label || !recipient.recipient) return

    setGift({
      params: {
        chainId,
        label: name.label,
        recipient: recipient.recipient.address,
        years,
        token,
      },
      recipientName: recipient.recipient.name,
      price: name.price?.total,
    })
    setGiftOpen(true)
  }

  function resetForm() {
    setGiftOpen(false)
    setNameInput('')
    setRecipientInput('')
    setYearsInput('1')
  }

  const { symbol } = PAYMENT_TOKENS[token]

  return (
    <div {...styles.layout()}>
      <Nav />

      <main {...styles.main()}>
        <header {...styles.header()}>
          <h1 {...styles.title()}>
            Gift an{' '}
            <span {...styles.titleMono()}>
              <span aria-hidden {...styles.bracket()}>
                [
              </span>
              ENS name
              <span aria-hidden {...styles.bracket()}>
                ]
              </span>
            </span>
          </h1>
          <p {...styles.subtitle()}>
            Register a .eth name directly to someone else's wallet. It's theirs
            from the moment it's registered, already pointing to their address.
          </p>
        </header>

        <form onSubmit={handleSubmit} {...styles.card()}>
          <div {...styles.fields()}>
            <Input
              label="Name"
              placeholder="gregskril"
              maxLength={64}
              suffix={
                name.isLoading || name.isTyping
                  ? nameInput && <Spinner />
                  : '.eth'
              }
              value={nameInput}
              error={nameError}
              hint={
                name.label && name.isAvailable ? (
                  <span {...styles.available()}>Available</span>
                ) : undefined
              }
              onChange={(e) => setNameInput(e.target.value)}
            />

            <Input
              label="Recipient"
              placeholder="0xA0Cf…251e or name.eth"
              maxLength={255}
              value={recipientInput}
              suffix={recipient.isLoading && recipientInput && <Spinner />}
              error={recipient.error}
              hint={
                recipient.recipient?.name &&
                recipientInput.trim() !== recipient.recipient.name
                  ? recipient.recipient.name
                  : recipient.recipient && recipientInput.includes('.')
                    ? `${recipient.recipient.address.slice(0, 6)}…${recipient.recipient.address.slice(-4)}`
                    : undefined
              }
              onChange={(e) => setRecipientInput(e.target.value)}
            />

            <Input
              label="Duration"
              placeholder="1"
              inputMode="numeric"
              value={yearsInput}
              error={invalidYears ? '1 to 100 years' : undefined}
              suffix={years === 1 ? 'year' : 'years'}
              onChange={(e) =>
                setYearsInput(e.target.value.replace(/[^0-9]/g, ''))
              }
            />
          </div>

          <div {...styles.footerRow()}>
            <div
              role="radiogroup"
              aria-label="Payment token"
              {...styles.tokens()}
            >
              {(Object.keys(PAYMENT_TOKENS) as PaymentToken[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={token === t}
                  onClick={() => setToken(t)}
                  {...cx(styles.token(), token === t && styles.tokenActive())}
                >
                  {PAYMENT_TOKENS[t].symbol}
                </button>
              ))}
            </div>

            <div {...styles.price()}>
              {name.price ? (
                <>
                  <span {...styles.priceValue()}>
                    {formatTokenAmount(name.price.total, token)} {symbol}
                  </span>
                  {name.price.premium > 0n && (
                    <span {...styles.premium()}>
                      incl. {formatTokenAmount(name.price.premium, token)}{' '}
                      premium
                    </span>
                  )}
                </>
              ) : name.isPriceLoading ? (
                <Spinner />
              ) : (
                <span {...styles.pricePlaceholder()}>Paid in {symbol}</span>
              )}
            </div>
          </div>

          {!isConnected ? (
            <Button type="submit">Connect Wallet</Button>
          ) : unsupportedChain ? (
            <Button
              loading={isSwitching}
              onClick={() => switchChain({ chainId: mainnet.id })}
            >
              Switch to Ethereum
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!canSubmit}
              loading={name.isLoading && !!name.label}
            >
              {name.label ? `Gift ${name.label}.eth` : 'Gift'}
            </Button>
          )}
        </form>

        {isConnected && chainId === sepolia.id && (
          <TestnetFaucet token={token} />
        )}
      </main>

      <footer {...styles.footer()}>
        <span>
          Built by{' '}
          <a
            href="https://x.com/gregskril"
            target="_blank"
            rel="noreferrer"
            {...styles.footerLink()}
          >
            gregskril.eth
          </a>
        </span>
        <a
          href="https://github.com/gskril/ens-fairy"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          {...styles.footerLink()}
        >
          <GithubIcon />
        </a>
      </footer>

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      <GiftDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        onComplete={resetForm}
        params={gift?.params}
        recipientName={gift?.recipientName}
        price={gift?.price}
      />

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            borderRadius: '999px',
            fontWeight: 500,
            fontFamily: 'var(--font)',
          },
        }}
      />
    </div>
  )
}

namespace styles {
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
    margin: 'auto 0',
  })

  export const header = style({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    textAlign: 'center',
  })

  // Brand headline: 96% line height, -3% letter spacing
  export const title = style({
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 500,
    letterSpacing: '-0.03em',
    lineHeight: 0.96,
    '@media (min-width: 640px)': { fontSize: '4rem' },
  })

  // The brand's bracketed, semi-mono emphasis ("Welcome to the [New Internet]")
  export const titleMono = style({
    fontFamily: 'var(--font-mono)',
    letterSpacing: '-0.06em',
    wordSpacing: '-0.3em',
    whiteSpace: 'nowrap',
  })

  export const bracket = style({
    color: 'var(--blue-light)',
    fontFamily: 'var(--font)',
    fontWeight: 400,
  })

  export const subtitle = style({
    maxWidth: '32rem',
    margin: 0,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: '1.1875rem',
    lineHeight: 1.35,
  })

  export const card = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--surface)',
    '@media (min-width: 640px)': { padding: '1.5rem' },
  })

  export const fields = style({
    display: 'grid',
    gap: '1rem',
    '@media (min-width: 640px)': {
      gridTemplateColumns: '3fr 4fr 2fr',
      alignItems: 'start',
    },
  })

  export const available = style({ color: 'var(--green)' })

  export const footerRow = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  })

  export const tokens = style({
    display: 'inline-flex',
    padding: '0.25rem',
    gap: '0.25rem',
    borderRadius: '0.625rem',
    backgroundColor: 'var(--surface-secondary)',
  })

  export const token = style({
    padding: '0.375rem 0.75rem',
    border: 'none',
    borderRadius: '0.4375rem',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    ':hover': { color: 'var(--text)' },
  })

  export const tokenActive = style({
    backgroundColor: 'var(--blue-light)',
    color: 'var(--blue)',
    ':hover': { color: 'var(--blue)' },
  })

  export const price = style({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    color: 'var(--text-secondary)',
  })

  export const priceValue = style({
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    fontSize: '1.0625rem',
    fontVariantNumeric: 'tabular-nums',
  })

  export const premium = style({ fontSize: '0.8125rem' })

  export const pricePlaceholder = style({ fontWeight: 500 })

  export const footer = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    width: '100%',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  })

  export const footerLink = style({
    display: 'inline-flex',
    color: 'var(--text-secondary)',
    transitionProperty: 'color',
    transitionDuration: '150ms',
    ':hover': { color: 'var(--blue)' },
  })
}
