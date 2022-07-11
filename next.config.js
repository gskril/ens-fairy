const { withPlausibleProxy } = require('next-plausible')

/** @type {import('next').NextConfig} */
module.exports = withPlausibleProxy()({
	images: {
		domains: ['metadata.ens.domains'],
	},
	reactStrictMode: true,
})
