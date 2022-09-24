import Head from 'next/head'
import Confetti from 'react-confetti'
import Header from '../components/header'
import { useEffect, useState } from 'react'
import { usePlausible } from 'next-plausible'
import toast, { Toaster } from 'react-hot-toast'
import useWindowSize from 'react-use/lib/useWindowSize'
import { Button, Dialog, Select, Typography } from '@ensdomains/thorin'
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi'
import {
  ensBaseRegistrarAddr,
  ensBaseRegistrarAbi,
  ensFairyVault,
} from '../lib/constants'

export default function Depost() {
  const plausible = usePlausible()
  const { address: connectedAddress } = useAccount()
  const { width: windowWidth, height: windowHeight } = useWindowSize()

  const [nfts, setNfts] = useState([])
  const [selectedNft, setSelectedNft] = useState()
  const [nameTransferred, setNameTransferred] = useState(false)

  // Get NFTs from OpenSea
  useEffect(() => {
    const fetchNfts = async () => {
      const opensea = await fetch(`
        https://api.opensea.io/api/v1/assets?owner=${connectedAddress}&collection=ens&limit=50
      `)
      const nfts = await opensea.json()
      setNfts(
        nfts.assets.map((nft) => {
          return {
            label: nft.name,
            value: nft.token_id,
          }
        })
      )
    }
    if (connectedAddress) fetchNfts()
  }, [connectedAddress])

  // Call `transferFrom` on the ENS contract
  const transferName = useContractWrite({
    addressOrName: ensBaseRegistrarAddr,
    contractInterface: ensBaseRegistrarAbi,
    functionName: 'transferFrom',
    chainId: 1,
    args: [
      connectedAddress, // address from
      ensFairyVault, // address to
      selectedNft?.value, // token id
    ],
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
    chainId: 1,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Transaction failed')
      } else {
        toast.success('Name transferred successfully!')
        setNameTransferred(true)

        // Plausible Analytics
        plausible('Name Transfer', {
          props: {
            name: selectedNft?.label,
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
      <Header position="absolute" />

      {nameTransferred && (
        <Confetti
          width={windowWidth}
          height={windowHeight}
          colors={['#44BCFO', '#7298F8', '#A099FF', '#DE82FF', '#7F6AFF']}
          style={{ zIndex: '100' }}
        />
      )}

      <div className="container container--flex">
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
          <Select
            options={nfts}
            required
            tabIndex={2}
            disabled={processing}
            label="Select a name to deposit"
            onChange={(e) => {
              const selectedNft = nfts.find(
                (nft) => nft.value === e.target.value
              )
              setSelectedNft(selectedNft)
            }}
          />
          <div className="button-wrapper">
            <Button
              type="submit"
              variant="action"
              loading={processing}
              disabled={processing}
            >
              Send to the vault
            </Button>
          </div>
        </form>
        <div className="what-is-this">
          <Typography
            as="p"
            size="base"
            weight="semiBold"
            color="textTertiary"
            onClick={() => setDialogOpen(true)}
          >
            What is this?
          </Typography>
        </div>
      </div>
      <Dialog
        open={dialogOpen}
        title="What is The Vault?"
        className="modal"
        onDismiss={() => setDialogOpen(false)}
      >
        <Typography size="base">
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
      </Dialog>

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

        @media screen and (min-width: 29em) {
          .button-wrapper {
            transform: scale(1.25);
            margin: 2rem 2rem;
          }
        }
      `}</style>
    </>
  )
}
