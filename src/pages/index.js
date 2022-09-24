import Head from 'next/head'
import Link from 'next/link'
import { ethers } from 'ethers'
import { useState } from 'react'
import useFetch from '../hooks/fetch'
import { formatUsd } from '../lib/utils'
import Header from '../components/header'
import toast, { Toaster } from 'react-hot-toast'
import { normalize } from '@ensdomains/eth-ens-namehash'
import Registration from '../components/registration-modal'
import {
  Button,
  Checkbox,
  Heading,
  Input,
  Typography,
} from '@ensdomains/thorin'
import { useAccount, useNetwork, useProvider } from 'wagmi'
import { ensRegistrarAddr, ensRegistrarAbi } from '../lib/constants'

export default function Home() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nameToRegister, setNameToRegister] = useState('')
  const [ownerToRegister, setOwnerToRegister] = useState('')
  const [durationToRegister, setDurationToRegister] = useState(0)
  const [ownerToRegisterText, setOwnerToRegisterText] = useState('')
  const [recipientBeforeCheckbox, setRecipientBeforeCheckbox] = useState('')
  const yearInSeconds = 365 * 24 * 60 * 60
  const durationInSeconds = (durationToRegister || 1) * yearInSeconds

  const provider = useProvider()
  const { chain, chains } = useNetwork()
  const { address: isConnected } = useAccount()
  const ethRegistrar = new ethers.Contract(
    ensRegistrarAddr,
    ensRegistrarAbi,
    provider
  )

  const handlePrice = async (name) => {
    if (name === '') return setNamePrice(5)

    const registrationFee = await ethRegistrar
      .rentPrice(name, yearInSeconds)
      .then((res) => ethers.utils.formatEther(res) * ethPrice)
      .catch(() => 5)

    if (registrationFee == 0) return setNamePrice(5)
    setNamePrice(parseInt(registrationFee))
  }

  // Live Ethereum stats
  const gasApi = useFetch('https://gas.best/stats')
  const gasPrice = gasApi.data?.pending?.fee + 1
  const ethPrice = gasApi.data?.ethPrice

  // Cost estimates
  const [namePrice, setNamePrice] = useState(5)
  const commitGasAmount = 50000
  const registrationGasAmount = 300000
  const commitCost = parseFloat(
    ethPrice * gasPrice * commitGasAmount * 0.000000001
  )
  const registrationCost = parseFloat(
    ethPrice * gasPrice * registrationGasAmount * 0.000000001 +
      namePrice * Number(durationToRegister || 1)
  )

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
      <Header position="absolute" />
      <div className="container container--flex">
        <Heading
          as="h1"
          level="1"
          align="center"
          style={{ marginBottom: '2rem', lineHeight: '1' }}
        >
          Gift an ENS name
        </Heading>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault()

            if (nameToRegister.length < 3) {
              toast.error('.eth names must be at least 3 characters')
              return
            }

            // Normalize name
            try {
              const normalizedName = normalize(nameToRegister)
              setNameToRegister(normalizedName)
            } catch (e) {
              toast.error(`${nameToRegister}.eth is not a valid name`)
              setNamePrice(5)
              return
            }

            handlePrice(nameToRegister)

            // Validate name
            const isNameAvailable = await ethRegistrar.available(
              nameToRegister.toLowerCase()
            )
            if (!isNameAvailable) {
              return toast.error(`${nameToRegister}.eth is not available`)
            }

            // Check wallet connection
            if (!isConnected) {
              return toast.error('Connect your wallet')
            }

            // Check the connected chain
            if (!chains.some((c) => c.id === chain.id)) {
              return toast.error('Switch to a supported network')
            }

            // Validate owner
            if (!ownerToRegister) {
              return toast.error('Please enter a recipient address')
            }

            let isValidOwner = false
            if (ethers.utils.isAddress(ownerToRegister)) {
              isValidOwner = true
            } else {
              try {
                const resolvedName = await provider.resolveName(ownerToRegister)
                if (resolvedName) {
                  isValidOwner = true
                  setOwnerToRegister(resolvedName)
                }
              } catch {
                isValidOwner = false
              }
            }

            if (!isValidOwner) {
              return toast.error(`${ownerToRegister} is not a valid address`)
            }

            // Check that a duration is set
            if (durationToRegister < 1) {
              toast.error('Please set a duration')
              return
            }

            setDialogOpen(true)
          }}
        >
          <div className="col">
            <Input
              label="Name"
              placeholder="gregskril"
              maxLength="42"
              required
              spellCheck="false"
              autoCapitalize="none"
              suffix=".eth"
              parentStyles={{ backgroundColor: '#fff' }}
              onBlur={(e) => handlePrice(e.target.value)}
              onChange={(e) => setNameToRegister(e.target.value)}
            />
            <Input
              label="Recipient"
              placeholder="0xA0Cf…251e"
              value={ownerToRegisterText}
              maxLength="42"
              required
              spellCheck="false"
              autoCapitalize="none"
              parentStyles={{
                width: '20rem',
                backgroundColor: '#fff',
              }}
              onChange={(e) => {
                setOwnerToRegister(e.target.value)
                setOwnerToRegisterText(e.target.value)
              }}
            />
            <Input
              label="Duration"
              placeholder="1"
              type="number"
              units={durationToRegister > 1 ? 'years' : 'year'}
              required
              min={1}
              max={10}
              parentStyles={{ backgroundColor: '#fff' }}
              onChange={(e) => setDurationToRegister(Number(e.target.value))}
            />
          </div>
          <Button
            type="submit"
            variant="action"
            suffix={
              // Total cost of registration
              !gasApi.isLoading && formatUsd(commitCost + registrationCost)
            }
          >
            Register
          </Button>
          <div
            style={{
              margin: 'auto',
            }}
          >
            <Checkbox
              label="Send to The ENS Fairy Vault"
              checked={ownerToRegisterText === 'ensfairy.xyz'}
              onChange={() => {
                const ensFairy = 'ensfairy.xyz'

                if (ownerToRegister === ensFairy) {
                  setOwnerToRegister(recipientBeforeCheckbox)
                  setOwnerToRegisterText(recipientBeforeCheckbox)
                } else {
                  setRecipientBeforeCheckbox(ownerToRegisterText)
                  setOwnerToRegister(ensFairy)
                  setOwnerToRegisterText(ensFairy)
                }
              }}
            />
          </div>
          <Registration
            commitCost={commitCost}
            duration={durationInSeconds}
            name={nameToRegister}
            open={dialogOpen}
            owner={ownerToRegister}
            registrationCost={registrationCost}
            setIsOpen={setDialogOpen}
          />
        </form>
      </div>

      <div className="footer">
        <Link href="/deposit">
          <a>
            <Typography
              as="p"
              size="base"
              weight="semiBold"
              color="textTertiary"
            >
              Send existing names to The ENS Fairy Vault
            </Typography>
          </a>
        </Link>
      </div>

      <Toaster position="bottom-center" />
    </>
  )
}
