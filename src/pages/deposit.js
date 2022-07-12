import Head from 'next/head'
import Confetti from 'react-confetti'
import Header from '../components/header'
import { useEffect, useState } from 'react'
import { usePlausible } from 'next-plausible'
import toast, { Toaster } from 'react-hot-toast'
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

	const [nfts, setNfts] = useState([])
	const [selectedNft, setSelectedNft] = useState()
	const [nameTransferred, setNameTransferred] = useState(false)

	// Get NFTs from OpenSea
	useEffect(() => {
		const fetchNfts = async () => {
			const opensea = await fetch(`
        https://api.opensea.io/api/v1/assets?owner=${connectedAddress}&collection=ens&limit=20
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
					content="Deposit your name into the ENS Fairy Vault"
				/>
				<meta
					property="og:description"
					content="Deposit your name into the ENS Fairy Vault"
				/>
				<meta
					property="og:image"
					content="https://ensfairy.com/sharing.png"
				/>
			</Head>
			<Header />

			{nameTransferred && (
				<Confetti
					colors={[
						'#44BCFO',
						'#7298F8',
						'#A099FF',
						'#DE82FF',
						'#7F6AFF',
					]}
					style={{ zIndex: '100' }}
				/>
			)}

			<div className="container">
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
						The vault is a multi-sig owned by{' '}
						<a
							href="https://twitter.com/ValidatorEth"
							target="_blank"
							rel="noreferrer"
						>
							validator.eth
						</a>{' '}
						and{' '}
						<a
							href="https://twitter.com/nicksdjohnson"
							target="_blank"
							rel="noreferrer"
						>
							nick.eth
						</a>
						.
					</p>
					<p>
						It is meant to protect ENS names for brands and public
						figures that community members were nice enough to
						reserve, and are willing to hand over to the rightful
						owner free of charge.
					</p>
					<p>
						When the intended person/brand is ready for their name,
						the multi-sig will transfer it to them free of charge.
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
