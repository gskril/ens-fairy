import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import { useId } from 'react'
import { type Props, cx, style, variants } from 'zyzz'
import { keyframes } from 'zyzz/web'

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
})

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden
      {...styles.spinner({ style: { width: size, height: size } })}
    />
  )
}

export function Button({
  tone,
  size,
  loading,
  children,
  disabled,
  ...props
}: Pick<Props.Variants<typeof styles.button>, 'tone' | 'size'> &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style'> & {
    loading?: boolean
  }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
      {...styles.button({ tone, size })}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Input({
  label,
  suffix,
  error,
  hint,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> & {
  label: string
  suffix?: ReactNode
  error?: string
  hint?: ReactNode
}) {
  const id = useId()

  return (
    <div {...styles.field()}>
      <label htmlFor={id} {...styles.label()}>
        {label}
      </label>
      <div data-invalid={error ? '' : undefined} {...styles.inputWrapper()}>
        <input
          id={id}
          aria-invalid={!!error}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          {...props}
          {...styles.input()}
        />
        {suffix && <span {...styles.suffix()}>{suffix}</span>}
      </div>
      {error ? (
        <span role="alert" {...cx(styles.message(), styles.error())}>
          {error}
        </span>
      ) : hint ? (
        <span {...styles.message()}>{hint}</span>
      ) : null}
    </div>
  )
}

namespace styles {
  export const spinner = style({
    display: 'inline-block',
    flexShrink: 0,
    borderRadius: '50%',
    border: '2px solid currentColor',
    borderRightColor: 'transparent',
    animationName: spin,
    animationDuration: '700ms',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  })

  export const button = variants({
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      width: '100%',
      border: 'none',
      borderRadius: 'var(--radius)',
      fontWeight: 700,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transitionProperty: 'transform, filter, background-color, opacity',
      transitionDuration: '150ms',
      ':hover': { transform: 'translateY(-1px)' },
      ':active': { transform: 'translateY(0)' },
      ':focus-visible': {
        outline: '2px solid var(--blue)',
        outlineOffset: '2px',
      },
      ':disabled': {
        cursor: 'not-allowed',
        transform: 'none',
        opacity: 0.6,
      },
    },
    defaultVariants: { tone: 'primary', size: 'regular' },
    variants: {
      tone: {
        primary: {
          backgroundImage: 'var(--gradient)',
          color: 'white',
          boxShadow: '0 4px 14px rgba(114, 152, 248, 0.35)',
          ':hover': { backgroundImage: 'var(--gradient-hover)' },
          ':disabled': {
            backgroundImage: 'none',
            backgroundColor: 'var(--border)',
            color: 'var(--text-secondary)',
            boxShadow: 'none',
            opacity: 1,
          },
        },
        secondary: {
          backgroundColor: 'var(--blue-light)',
          color: 'var(--blue)',
          ':hover': { backgroundColor: '#d6e6ff' },
        },
        ghost: {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          ':hover': {
            backgroundColor: 'var(--surface-secondary)',
            transform: 'none',
          },
        },
        danger: {
          backgroundColor: 'var(--red-light)',
          color: 'var(--red)',
        },
      },
      size: {
        regular: { height: '3.25rem', padding: '0 1.25rem', fontSize: '1rem' },
        small: {
          height: '2.5rem',
          padding: '0 1rem',
          fontSize: '0.9375rem',
          borderRadius: '0.75rem',
        },
      },
    },
  })

  export const field = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    minWidth: 0,
  })

  export const label = style({
    paddingLeft: '0.5rem',
    fontWeight: 700,
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
  })

  export const inputWrapper = style({
    display: 'flex',
    alignItems: 'center',
    height: '3.25rem',
    paddingRight: '1rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    transitionProperty: 'border-color, box-shadow',
    transitionDuration: '150ms',
    ':focus-within': {
      borderColor: '#a8c8ff',
      boxShadow: '0 0 0 4px rgba(56, 137, 255, 0.12)',
    },
    '&[data-invalid]': {
      borderColor: 'var(--red)',
      boxShadow: '0 0 0 4px rgba(198, 48, 27, 0.08)',
    },
  })

  export const input = style({
    flex: 1,
    minWidth: 0,
    height: '100%',
    padding: '0 0 0 1rem',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '1rem',
    fontWeight: 500,
    '::placeholder': { color: 'var(--text-tertiary)' },
  })

  export const suffix = style({
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '0.5rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  })

  export const message = style({
    paddingLeft: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  })

  export const error = style({ color: 'var(--red)' })
}
