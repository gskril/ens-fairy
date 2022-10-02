import Head from 'next/head'
import EnsProfile from '../components/ens-profile'
import { Button, Heading, Typography } from '@ensdomains/thorin'

import Header from '../components/header'

export default function Start() {
  return (
    <>
      <Head>
        <title>Get Started with ENS</title>
        <meta property="og:title" content="Get Started with ENS" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:creator" content="@gregskril" />
        <meta
          name="description"
          content="Learn about and set up your .eth name from ENS."
        />
        <meta
          property="og:description"
          content="Learn about and set up your .eth name"
        />
        <meta property="og:image" content="https://ensfairy.xyz/sharing.png" />
      </Head>

      <Header />

      <main className="container container--lg">
        <Heading level="1" align="center">
          What is ENS?
        </Heading>
        <Typography as="p" style={{ textAlign: 'center' }}>
          ENS is a decentralized profile that lives on Ethereum.
        </Typography>

        <EnsProfile address="0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5" />

        <Button>Connect your wallet to manage your ENS name</Button>
      </main>
    </>
  )
}

// https://excalidraw.com/
