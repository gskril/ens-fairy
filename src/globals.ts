import { global } from 'zyzz/web'

global({
  ':root': {
    '--blue': '#3889ff',
    '--blue-light': '#e6f0ff',
    '--gradient':
      'linear-gradient(330.4deg, #44bcf0 4.54%, #7298f8 59.2%, #a099ff 148.85%)',
    '--gradient-hover':
      'linear-gradient(330.4deg, #36aee2 4.54%, #6189ef 59.2%, #9089f7 148.85%)',
    '--text': '#1e2122',
    '--text-secondary': '#9b9ba7',
    '--text-tertiary': '#c1c1cb',
    '--background': '#f6f6f6',
    '--surface': '#ffffff',
    '--surface-secondary': '#f7f7f8',
    '--border': '#e8e8e8',
    '--red': '#c6301b',
    '--red-light': '#fdf2f1',
    '--green': '#199c75',
    '--green-light': '#e7f4ef',
    '--radius': '1rem',
    '--radius-lg': '1.5rem',
    '--shadow': '0 2px 12px rgba(0, 0, 0, 0.04)',
    '--font':
      "'Satoshi', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    '--font-mono':
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
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
    backgroundImage:
      'radial-gradient(60rem 30rem at 50% -10rem, rgba(114, 152, 248, 0.14), transparent)',
    backgroundRepeat: 'no-repeat',
  },
  a: { color: 'inherit', textDecoration: 'none' },
  'button, input, select': { font: 'inherit', color: 'inherit' },
  '::selection': { backgroundColor: 'rgba(114, 152, 248, 0.25)' },
})
