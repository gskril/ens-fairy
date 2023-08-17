const withPWA = require('next-pwa')({ dest: 'public' })
const { withPlausibleProxy } = require('next-plausible')

/** @type {import('next').NextConfig} */
module.exports = withPWA(
  {
    pwa: {
      dest: 'public',
      register: true,
      disable: process.env.NODE_ENV === 'development',
      skipWaiting: true,
    },
  },
  withPlausibleProxy()({
    images: {
      domains: ['metadata.ens.domains'],
    },
    reactStrictMode: true,
  })
)
