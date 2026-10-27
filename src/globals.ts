import { global } from 'zyzz/web'

// Colors and type follow the ENS brand guidelines (ens.domains/brand).
// ABC Monument Grotesk and ABC Marist are licensed fonts that can't be
// redistributed, so free stand-ins load from Google Fonts. Self-hosting the
// licensed files with matching @font-face names will take precedence.
global({
  ':root': {
    // Primary palette
    '--blue': '#0080bc', // ENS Blue
    '--blue-hover': '#006fa3',
    '--blue-light': '#cee1e8', // Light Blue
    '--blue-light-hover': '#bdd6df',
    '--text': '#011a25', // Dark Blue
    '--background': '#f6f6f6', // White
    // Extended palette
    '--text-secondary': '#4a5c63', // Gray
    '--text-tertiary': '#8b989d',
    '--border': '#e5e5e5', // Gray 2
    '--border-strong': '#c4c7c8', // Gray 3
    '--green': '#007c23', // Green
    '--green-light': '#c5ddcc', // Light Green
    '--error': '#f53293', // Magenta
    '--error-text': '#c8176f', // Magenta, darkened for small text contrast
    '--error-light': '#f2c4da', // Light Magenta
    // Surfaces
    '--surface': '#ffffff',
    '--surface-secondary': '#f6f6f6',
    '--radius': '0.75rem',
    '--radius-lg': '1.25rem',
    // Type
    '--font':
      "'ABC Monument Grotesk', 'Inter Tight', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    '--font-body': "'ABC Marist', 'Newsreader', Georgia, serif",
    '--font-mono':
      "'ABC Monument Grotesk Semi-Mono', 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  html: {
    backgroundColor: 'var(--background)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
    WebkitFontSmoothing: 'antialiased',
  },
  body: {
    minHeight: '100svh',
    margin: 0,
    // The brand's tiled "snippet" background, kept faint
    backgroundImage:
      'radial-gradient(circle, rgba(0, 128, 188, 0.16) 1px, transparent 1.5px)',
    backgroundSize: '24px 24px',
    backgroundPosition: 'center top',
  },
  a: { color: 'inherit', textDecoration: 'none' },
  'button, input, select': { font: 'inherit', color: 'inherit' },
  '::selection': { backgroundColor: 'var(--blue-light)' },
})
