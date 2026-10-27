import { getName } from '@ensdomains/ensjs/public'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useConnection, useDisconnect } from 'wagmi'
import { style } from 'zyzz'

import { useEnsClient } from '../hooks/useEnsClient'
import { getChain, isSupportedChain, mainnet } from '../lib/wagmi'
import { Avatar, shortenAddress } from './Avatar'
import { WalletModal } from './WalletModal'
import { FairyMark } from './icons'
import { Button } from './ui'

export function Nav() {
  return (
    <nav {...styles.nav()}>
      <a href="/" aria-label="ENS Fairy home" {...styles.logo()}>
        <FairyMark size={36} />
        <span {...styles.wordmark()}>ENS Fairy</span>
      </a>
      <ConnectButton />
    </nav>
  )
}

export function usePrimaryName(address: `0x${string}` | undefined) {
  const { chainId } = useConnection()
  const supportedChainId = isSupportedChain(chainId) ? chainId : mainnet.id
  const client = useEnsClient(supportedChainId)

  return useQuery({
    queryKey: ['primary-name', supportedChainId, address],
    queryFn: async () => {
      const result = await getName(client, { address: address! })
      return result?.match ? result.name : null
    },
    enabled: !!address,
  })
}

function ConnectButton() {
  const { address, chainId, isConnected } = useConnection()
  const { mutate: disconnect } = useDisconnect()
  const { data: name } = usePrimaryName(address)
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [menuOpen])

  if (!isConnected || !address) {
    return (
      <>
        <div {...styles.connect()}>
          <Button size="small" onClick={() => setModalOpen(true)}>
            Connect
          </Button>
        </div>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  const chain = isSupportedChain(chainId) ? getChain(chainId) : undefined

  return (
    <div ref={menuRef} {...styles.profileWrapper()}>
      {chain && chain.id !== mainnet.id && (
        <span {...styles.chainBadge()}>{chain.name}</span>
      )}
      <button
        type="button"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        {...styles.profile()}
      >
        <Avatar name={name ?? undefined} chainId={chainId ?? 1} size={32} />
        <span {...styles.profileName()}>{name ?? shortenAddress(address)}</span>
      </button>

      {menuOpen && (
        <div role="menu" {...styles.menu()}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              navigator.clipboard.writeText(address)
              toast.success('Copied address')
              setMenuOpen(false)
            }}
            {...styles.menuItem()}
          >
            Copy address
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              disconnect()
              setMenuOpen(false)
            }}
            {...styles.menuItem()}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

namespace styles {
  export const nav = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1.5rem',
    width: '100%',
  })

  export const logo = style({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  })

  export const wordmark = style({
    color: 'var(--text)',
    fontSize: '1.375rem',
    fontWeight: 500,
    letterSpacing: '-0.03em',
  })

  export const connect = style({ width: '8rem' })

  export const profileWrapper = style({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
  })

  export const chainBadge = style({
    padding: '0.25rem 0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--blue-light)',
    color: 'var(--blue)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    fontWeight: 500,
  })

  export const profile = style({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    maxWidth: '13rem',
    padding: '0.25rem 1rem 0.25rem 0.25rem',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    backgroundColor: 'var(--surface)',
    fontWeight: 500,
    cursor: 'pointer',
    transitionProperty: 'transform',
    transitionDuration: '150ms',
    ':hover': { transform: 'translateY(-1px)' },
  })

  export const profileName = style({
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9375rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  export const menu = style({
    position: 'absolute',
    top: 'calc(100% + 0.5rem)',
    right: 0,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    minWidth: '100%',
    padding: '0.375rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    backgroundColor: 'var(--surface)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
  })

  export const menuItem = style({
    padding: '0.625rem 0.75rem',
    border: 'none',
    borderRadius: '0.625rem',
    backgroundColor: 'transparent',
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--surface-secondary)' },
  })
}
