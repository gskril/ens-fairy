import { Button, Select, Typography } from '@ensdomains/thorin'
import { usePlausible } from 'next-plausible'
import Head from 'next/head'
import { useState } from 'react'
import Confetti from 'react-confetti'
import toast, { Toaster } from 'react-hot-toast'
import useWindowSize from 'react-use/lib/useWindowSize'
import styled from 'styled-components'
import {
  useAccount,
  useContractWrite,
  useNetwork,
  useWaitForTransaction,
} from 'wagmi'

import { Nav } from '../components/Nav'
import { Layout, StyledDialog } from '../components/atoms'
import Header from '../components/header'
import { Domain, useEnsNames } from '../hooks/useEnsNames'
import { getBaseRegistrar, ensFairyVault } from '../lib/constants'

export default function Depost() {
  const plausible = usePlausible()
  const { chain } = useNetwork()
  const { address: connectedAddress } = useAccount()
  const { width: windowWidth, height: windowHeight } = useWindowSize()

  const { data: domains } = useEnsNames(connectedAddress, chain?.id)
  const [selectedNft, setSelectedNft] = useState<Domain | undefined>()
  const [nameTransferred, setNameTransferred] = useState(false)
  const baseRegistrar = getBaseRegistrar()

  // Call `transferFrom` on the ENS contract
  const transferName = useContractWrite({
    ...baseRegistrar,
    functionName: 'transferFrom',
    args:
      connectedAddress && selectedNft
        ? [
            connectedAddress, // address from
            ensFairyVault, // address to
            BigInt(selectedNft.labelhash), // token id
          ]
        : undefined,
    onError: (err) => {
      if (err.message.includes('cannot estimate gas')) {
        toast.error('Unable to send transaction')
      } else {
        toast.error(err.message)
      }
    },
  })

  // Wait for the transaction to be mined
  const { isLoading: processing } = useWaitForTransaction({
    hash: transferName.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 'reverted'
      if (didFail) {
        toast.error('Transaction failed')
      } else {
        toast.success('Name transferred successfully!')
        setNameTransferred(true)

        // Plausible Analytics
        plausible('Name Transfer', {
          props: {
            name: selectedNft?.name,
          },
        })
      }
    },
  })

  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Head>
        <title>ENS Fairy - Vault Deposit</title>
        <meta property="og:title" content="ENS Fairy - Vault Deposit" />
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:creator" content="@gregskril" />
        <meta
          name="description"
          content="Deposit names into The ENS Fairy Vault"
        />
        <meta
          property="og:description"
          content="Deposit names into The ENS Fairy Vault"
        />
        <meta property="og:image" content="https://ensfairy.xyz/sharing.png" />
      </Head>

      {nameTransferred && (
        <Confetti
          width={windowWidth}
          height={windowHeight}
          colors={['#44BCFO', '#7298F8', '#A099FF', '#DE82FF', '#7F6AFF']}
          style={{ zIndex: '100' }}
        />
      )}

      <Layout>
        <Nav />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: '100%',
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!connectedAddress) {
                toast.error('Connect your wallet')
                return
              } else if (!selectedNft) {
                toast.error('Select an ENS name from the dropdown')
                return
              }

              // Transfer the selected name to the ENS Fairy Vault
              transferName.write()
            }}
          >
            <StyledSelect
              options={
                domains?.map((domain) => {
                  return {
                    value: domain.labelhash,
                    label: domain.name,
                  }
                }) || [
                  {
                    value: 'Loading',
                  },
                ]
              }
              required
              tabIndex={2}
              disabled={processing}
              placeholder="Select a name to transfer"
              label="Select a name to deposit"
              onChange={(e) => {
                const selectedNft = domains?.find(
                  (domain) => domain.labelhash === e.target.value
                )
                setSelectedNft(selectedNft)
              }}
            />
            <div className="button-wrapper">
              <Button
                type="submit"
                loading={processing}
                colorStyle="accentGradient"
                disabled={processing}
              >
                Send to the vault
              </Button>
            </div>
          </form>
          <div className="what-is-this">
            <Typography
              asProp="p"
              color="textTertiary"
              onClick={() => setDialogOpen(true)}
            >
              What is this?
            </Typography>
          </div>
        </div>

        <footer />
      </Layout>

      <StyledDialog
        open={dialogOpen}
        variant="actionable"
        title="What is The Vault?"
        onDismiss={() => setDialogOpen(false)}
      >
        <Typography style={{ fontWeight: '400', lineHeight: 1.4 }}>
          <p>
            The ENS Fairy Vault is a wallet that can hold ENS names for
            individuals, organizations, and companies until they create an
            Ethereum wallet to self-custody their ENS name.
          </p>
          <p>
            You can register a name for someone else and deposit it to the ENS
            Fairy Vault, where it will be held for safekeeping until the
            recipient claims the name.
          </p>
          <p>
            The ENS Fairy Vault is a multisig wallet. The keyholders of the
            wallet are{' '}
            <a
              href="https://twitter.com/ValidatorEth"
              target="_blank"
              rel="noreferrer"
            >
              validator.eth
            </a>{' '}
            (support lead for ENS) and{' '}
            <a
              href="https://twitter.com/nicksdjohnson"
              target="_blank"
              rel="noreferrer"
            >
              nick.eth
            </a>{' '}
            (founder and lead developer of ENS).
          </p>
        </Typography>
      </StyledDialog>

      <Toaster position="bottom-center" />

      <style jsx>{`
        form {
          width: 24rem;
          max-width: 100%;
        }

        .button-wrapper {
          margin: 1rem 0;
        }

        .what-is-this:hover {
          cursor: pointer;
        }
      `}</style>
    </>
  )
}

const StyledSelect = styled(Select)`
  & > div:last-child {
    max-height: 20rem;
    overflow: scroll;
  }
`
