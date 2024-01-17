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
    images: {
      domains: ['metadata.ens.domains', 'i.imgur.com', 'imgur.com'],
    },
    reactStrictMode: true,
  },
  withPlausibleProxy()
)
