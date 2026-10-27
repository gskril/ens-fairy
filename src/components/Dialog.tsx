import { type ReactNode, useEffect, useRef } from 'react'
import { style } from 'zyzz'
import { keyframes } from 'zyzz/web'

import { CloseIcon } from './icons'

const rise = keyframes({
  from: { opacity: 0, transform: 'translateY(1rem) scale(0.98)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
})

const fade = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean
  /** Called when the user tries to dismiss (escape key or backdrop click) */
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Let the parent decide whether the dialog can close
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      {...styles.dialog()}
    >
      {open && (
        <div {...styles.panel()}>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            {...styles.close()}
          >
            <CloseIcon />
          </button>
          <h2 {...styles.title()}>{title}</h2>
          {description && <p {...styles.description()}>{description}</p>}
          {children}
        </div>
      )}
    </dialog>
  )
}

namespace styles {
  export const dialog = style({
    width: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    margin: 0,
    marginTop: 'auto',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    overflow: 'visible',
    '::backdrop': {
      backgroundColor: 'rgba(1, 26, 37, 0.3)',
      backdropFilter: 'blur(6px)',
      animationName: fade,
      animationDuration: '200ms',
    },
    '@media (min-width: 640px)': {
      maxWidth: '29rem',
      margin: 'auto',
    },
  })

  export const panel = style({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem 1rem 1rem',
    maxHeight: '90svh',
    overflowY: 'auto',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
    backgroundColor: 'var(--surface)',
    boxShadow: '0 12px 48px rgba(1, 26, 37, 0.12)',
    animationName: rise,
    animationDuration: '250ms',
    animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    '@media (min-width: 640px)': {
      padding: '1.5rem',
      borderRadius: 'var(--radius-lg)',
    },
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })

  export const close = style({
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    border: 'none',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--surface-secondary)' },
  })

  export const title = style({
    margin: 0,
    padding: '0 2rem',
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 500,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    overflowWrap: 'anywhere',
  })

  export const description = style({
    margin: 0,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '1.0625rem',
    lineHeight: 1.35,
    color: 'var(--text-secondary)',
  })
}
