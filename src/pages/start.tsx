import { Heading, Typography } from '@ensdomains/thorin'
import 'keen-slider/keen-slider.min.css'
import { useKeenSlider } from 'keen-slider/react'
import Head from 'next/head'
import Image from 'next/image'
import styled from 'styled-components'

import { EnsProfile } from '../components/EnsProfile'
import { Nav } from '../components/Nav'
import { Container, Layout } from '../components/atoms'

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
  max-width: 100%;
  line-height: 0;
  border-radius: 2rem;
  overflow: hidden;
`

const Slide = styled.div`
  position: relative;

  label {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 1.25rem;
    color: #fff;
  }
`

const ensExamples = [
  { name: 'uniswap.org', image: 'https://i.imgur.com/QxEMIa5.png' },
  { name: 'sushi.com', image: 'https://i.imgur.com/f1hQUnq.png' },
  { name: 'rainbowkit.com', image: 'https://i.imgur.com/tMUjese.png' },
  { name: 'snapshot.org', image: 'https://i.imgur.com/lxTGpEp.png' },
  // { name: 'ens.domains', image: 'https://i.imgur.com/8QqJAmv.png' },
  // { name: 'ensgrants.xyz', image: 'https://i.imgur.com/PX8ILdv.png' },
  // { name: 'nounsagora.com', image: 'https://i.imgur.com/gVk8PXE.png' },
  // { name: 'nouns.wtf', image: 'https://i.imgur.com/ZExnaL1.png' },
]

export default function Start() {
  const [sliderRef, instanceRef] = useKeenSlider({
    slideChanged() {
      console.log('slide changed')
    },
  })

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

      <Layout>
        <Nav />

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

            <Container>
              <CarouselWrapper ref={sliderRef} className="keen-slider">
                {ensExamples.map((item) => (
                  <Slide className="keen-slider__slide" key={item.name}>
                    <Image
                      src={item.image}
                      alt={`ENS in ${item.name}`}
                      width={900}
                      height={280}
                    />
                    <label>{item.name}</label>
                  </Slide>
                ))}
              </CarouselWrapper>
            </Container>
          </Why>
        </main>

        <footer />
      </Layout>
    </>
  )
}
