import { Button, Heading, Input, Typography } from '@ensdomains/thorin'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import Head from 'next/head'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { LoaderIcon, Toaster } from 'react-hot-toast'
import { isAddress } from 'viem'
import { normalize } from 'viem/ens'
import { useAccount, useContractRead, useEnsAddress, useNetwork } from 'wagmi'

import { Nav } from '../components/Nav'
import { Layout } from '../components/atoms'
import Registration from '../components/registration-modal'
import useDebounce from '../hooks/useDebounce'
import { useIsMounted } from '../hooks/useIsMounted'
import { getEthRegistrarController } from '../lib/constants'

export default function Home() {
  const { chain } = useNetwork()
  const isMounted = useIsMounted()
  const { address: isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()

  const [_nameToRegister, setNameToRegister] = useState('')
  const _nameToRegisterUnnormalized = useDebounce(_nameToRegister, 500)
  const [nameToRegisterIsInvalid, setNameToRegisterIsInvalid] = useState(false)

  const [_recipientInput, setRecipientInput] = useState('')
  const recipientInput = useDebounce(_recipientInput, 500)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [durationToRegister, setDurationToRegister] = useState(1)
  const registrarController = getEthRegistrarController()

  // If the debounced recipient input might be an ENS name, try to resolve it
  const { data: recipientEnsAddress, isLoading: isRecipientEnsAddressLoading } =
    useEnsAddress({
      name: recipientInput?.includes('.') ? recipientInput : undefined,
    })

  // Handle address or ENS input as recipient
  const recipientAddress = isAddress(recipientInput)
    ? recipientInput
    : recipientEnsAddress
    ? recipientEnsAddress
    : undefined

  // Normalize input and return label to register (without ".eth")
  const nameToRegister = () => {
    try {
      const cleanedName = _nameToRegisterUnnormalized
        ? _nameToRegisterUnnormalized.endsWith('')
          ? normalize(_nameToRegisterUnnormalized.split('.eth')[0])
          : normalize(_nameToRegisterUnnormalized)
        : ''

      if (cleanedName.includes('.')) {
        throw Error()
      }

      if (nameToRegisterIsInvalid) {
        setNameToRegisterIsInvalid(false)
      }

      return cleanedName
    } catch (err) {
      if (!nameToRegisterIsInvalid) {
        setNameToRegisterIsInvalid(true)
      }

      return undefined
    }
  }

  // Check if the debounced name is available
  const { data: isAvailable, isLoading: isAvailableLoading } = useContractRead({
    ...registrarController,
    functionName: !!nameToRegister() ? 'available' : undefined,
    args: !!nameToRegister() ? [nameToRegister()!] : undefined,
  })

  const isInvalidDuration = !/[1-9]/.test(durationToRegister.toString())

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!isConnected) {
      openConnectModal?.()
      return
    }

    setDialogOpen(true)
  }

  return (
    <>
      <Head>
        <title>ENS Fairy</title>
        <meta property="og:title" content="ENS Fairy" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:creator" content="@gregskril" />
        <meta
          name="description"
          content="Register an ENS name directly to another address"
        />
        <meta
          property="og:description"
          content="Register an ENS name directly to another address"
        />
        <meta property="og:image" content="https://ensfairy.xyz/sharing.png" />
      </Head>

      <Layout>
        <Nav />

        <div style={{ maxWidth: '100%' }}>
          <Heading
            as="h1"
            level="1"
            align="center"
            style={{ marginBottom: '2rem', lineHeight: '1' }}
          >
            Gift an ENS name
          </Heading>

          <form className="form" onSubmit={handleSubmit}>
            <div className="col">
              <Input
                label="Name"
                placeholder="gregskril"
                maxLength={42}
                spellCheck="false"
                autoCapitalize="none"
                suffix=".eth"
                error={
                  nameToRegisterIsInvalid
                    ? 'Invalid name'
                    : isAvailable === false
                    ? 'Not available'
                    : undefined
                }
                onChange={(e) => setNameToRegister(e.target.value)}
              />

              <Input
                label="Recipient"
                placeholder="0xA0Cf…251e"
                maxLength={42}
                suffix={
                  isRecipientEnsAddressLoading ? <LoaderIcon /> : undefined
                }
                spellCheck="false"
                autoCapitalize="none"
                parentStyles={
                  {
                    width: '20rem',
                    maxWidth: '100%',
                  } as any
                }
                error={
                  !!recipientInput &&
                  !isRecipientEnsAddressLoading &&
                  recipientAddress === undefined
                    ? 'Invalid address/name'
                    : undefined
                }
                onChange={(e) => setRecipientInput(e.target.value)}
              />

              <Input
                label="Duration"
                placeholder="1"
                inputMode="numeric"
                error={isInvalidDuration ? 'Invalid number' : undefined}
                suffix={durationToRegister > 1 ? 'years' : 'year'}
                onChange={(e) => setDurationToRegister(Number(e.target.value))}
              />
            </div>

            {!isConnected || !isMounted ? (
              <Button type="submit" colorStyle="accentGradient">
                Connect Wallet
              </Button>
            ) : chain?.unsupported ? (
              <Button disabled>Unsupported Network</Button>
            ) : (
              <Button
                type="submit"
                colorStyle="accentGradient"
                loading={isAvailableLoading}
                disabled={
                  !nameToRegister() ||
                  !recipientAddress ||
                  isAvailable === false ||
                  isInvalidDuration
                }
                suffix={chain?.id === 5 ? <span>({chain?.name})</span> : <></>}
              >
                Register
              </Button>
            )}
          </form>
        </div>

        <Link href="/deposit">
          <a>
            <Typography asProp="p" color="textTertiary">
              Send existing names to The ENS Fairy Vault
            </Typography>
          </a>
        </Link>
      </Layout>

      <Registration
        open={dialogOpen}
        setIsOpen={setDialogOpen}
        label={nameToRegister()}
        recipient={recipientAddress}
        duration={durationToRegister}
      />

      <Toaster position={dialogOpen ? 'top-center' : 'bottom-center'} />
    </>
  )
}
