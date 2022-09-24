import Head from 'next/head'
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
        <Heading>Get Started with ENS</Heading>
        <Typography as="p">What describes your current situation?</Typography>
        <Button>I just got a .eth name</Button>
        <Button>I want to get a .eth name</Button>

        <div className="got">
          <Heading>I just got a .eth name</Heading>
          <Typography as="p">
            Your .eth name is the name of your Ethereum address. So instead of
            asking somebody to pay 0x1234..., they can just pay name.eth.
            It&apos;s like how before regular domain names, like nike.com, you
            had to enter an IP Address like 108.139.47.109
          </Typography>
          <Typography as="p">
            Connect the wallet with your ENS name to manage your profile. We
            will help you set it as your primary ENS name,
          </Typography>
        </div>
      </main>

      <br />
      <br />

      <main className="container container--lg">
        <Heading level="1">
          Did you just get your first ENS name and not sure where to start?
        </Heading>
        <Heading>What is ENS?</Heading>
        <Typography as="p">
          Your .eth is the name of your Ethereum address.
        </Typography>
        <Typography as="p">
          So instead of asking somebody to pay 0x1234..., they can just pay
          name.eth.
        </Typography>
        <Typography as="p">
          It&apos;s like how before regular domain names such as nike.com, you
          had to enter an IP Address like 108.139.47.109
        </Typography>
        <Typography as="p">
          But an ENS name is more than just a domain... Its a composable web3
          profile that follows you around web3 so that you don&apos;t have to
          re-enter the same profile settings on each website you visit.
        </Typography>
        <Typography as="p">
          For example, rainbow.me shows the same profile data for gregskril.eth
          that eth.xyz does. This is because these tools, along with thousands
          of others, respect your ENS profile.
        </Typography>
        <Button>Connect your wallet to manage your ENS name</Button>
      </main>
    </>
  )
}

// https://excalidraw.com/
