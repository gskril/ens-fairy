import Head from 'next/head'
import Image from 'next/image'
import EnsProfile from '../components/ens-profile'
import { Heading, Typography } from '@ensdomains/thorin'
import styled from 'styled-components'

import Header from '../components/header'

const MainHeading = styled(Heading)`
  font-size: 3.5rem;
  font-weight: 900;
  margin-bottom: 1.5rem;
`

const SecondaryHeading = styled(Heading)`
  font-size: 2.875rem;
  font-weight: 900;
  margin-bottom: 1.5rem;
`

const Description = styled(Typography)`
  font-size: 1.125rem;
  text-align: center;
  line-height: 1.4;
  max-width: 45ch;
  margin: 0 auto;
  width: 100%;
`

const ProfileCarousel = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin: 2rem auto 0;
`

const Why = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  padding: 5rem 0;
`

const CarouselWrapper = styled.div`
  margin: 2rem auto 5rem;
  line-height: 0;
  border-radius: 2rem;
  overflow: hidden;
`

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
        <MainHeading level="1" align="center">
          What is ENS?
        </MainHeading>
        <Description as="p">
          ENS is a decentralized profile that lives on Ethereum.
        </Description>

        <ProfileCarousel>
          <EnsProfile address="0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5" />
        </ProfileCarousel>

        <Why>
          <SecondaryHeading as="h2">Why should you care?</SecondaryHeading>
          <Description as="p">
            Storing your profile on Ethereum enables you to seamlessly bring
            your data between apps. One profile for every app.
          </Description>

          <CarouselWrapper>
            <Image
              src="https://i.ibb.co/n3qfzfN/Rectangle-2.jpg"
              alt="ENS in Uniswap"
              width={900}
              height={280}
            />
          </CarouselWrapper>
        </Why>
      </main>
    </>
  )
}

// https://excalidraw.com/
