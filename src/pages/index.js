import Head from 'next/head'
import { ethers } from 'ethers'
import { useState } from 'react'
import useFetch from '../hooks/fetch'
import toast, { Toaster } from 'react-hot-toast'
import Registration from '../components/registration-modal'
import { Button, Heading, Input } from '@ensdomains/thorin'
import { useAccount, useNetwork, useProvider } from 'wagmi'
import ConnectButtonWrapper from '../components/connect-button'
import { ensRegistrarAddr, ensRegistrarAbi } from '../lib/constants'

export default function Home() {
	const [dialogOpen, setDialogOpen] = useState(false)
	const [nameToRegister, setNameToRegister] = useState('')
	const [ownerToRegister, setOwnerToRegister] = useState('')
	const [durationToRegister, setDurationToRegister] = useState('')

	const provider = useProvider()
	const { chain, chains } = useNetwork()
	const { address: isConnected } = useAccount()
	const ethRegistrar = new ethers.Contract(
		ensRegistrarAddr,
		ensRegistrarAbi,
		provider
	)

	// Live Ethereum stats
	const gasApi = useFetch('https://gas.best/stats')
	const gasPrice = gasApi.data?.pending?.fee
	const ethPrice = gasApi.data?.ethPrice

	// Cost estimates
	const commitGasAmount = 46267
	const registrationGasAmount = 280000
	const commitCost = parseFloat(
		ethPrice * gasPrice * commitGasAmount * 0.000000001
	)
	const registrationCost = parseFloat(
		ethPrice * gasPrice * registrationGasAmount * 0.000000001 +
			(durationToRegister || 1) * 5
	)

	return (
		<>
			<Head>
				<title>ENS Fairy</title>
				<meta property="og:title" content="Ethereum Name Service" />
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
				<meta
					property="og:image"
					content="https://ensfairy.com/sharing.png"
				/>
			</Head>
			<header className="header">
				<Heading as="span" level="2" className="header__name">
					ENS Fairy
				</Heading>
				<ConnectButtonWrapper />
			</header>
			<div className="container">
				<Heading
					as="h1"
					align="center"
					style={{ marginBottom: '2rem' }}
				>
					Register an ENS name directly to another address
				</Heading>
				<form
					className="form"
					onSubmit={async (e) => {
						e.preventDefault()

						// Check wallet connection
						if (!isConnected) {
							return toast.error('Connect your wallet')
						}

						// Check the connected chain
						if (!chains.some((c) => c.id === chain.id)) {
							return toast.error(`Switch to a supported network`)
						}

						// Check if all fields are filled
						if (
							nameToRegister.length < 3 ||
							ownerToRegister.length < 7 ||
							durationToRegister < 1
						) {
							return toast.error(
								'Please fill out all fields correctly'
							)
						}

						if (nameToRegister.length < 5) {
							return toast.error(
								'We only support 5+ character names',
								{
									style: {
										maxWidth: '100%',
									},
								}
							)
						}

						// Validate name
						const isNameAvailable = await ethRegistrar.available(
							nameToRegister.toLowerCase()
						)
						if (!isNameAvailable) {
							return toast.error(
								`${nameToRegister}.eth is not available`
							)
						}

						// Validate owner
						let isValidOwner = false
						if (ethers.utils.isAddress(ownerToRegister)) {
							isValidOwner = true
						} else {
							try {
								const resolvedName = await provider.resolveName(
									ownerToRegister
								)
								if (resolvedName) {
									isValidOwner = true
									setOwnerToRegister(resolvedName)
								}
							} catch {}
						}

						if (!isValidOwner) {
							return toast.error(
								`${ownerToRegister} is not a valid address`
							)
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
							onChange={(e) => setNameToRegister(e.target.value)}
						/>
						<Input
							label="Owner"
							placeholder="0xA0Cf…251e"
							maxLength="42"
							required
							spellCheck="false"
							autoCapitalize="none"
							parentStyles={{
								width: '20rem',
								backgroundColor: '#fff',
							}}
							onChange={(e) => setOwnerToRegister(e.target.value)}
						/>
						<Input
							label="Duration"
							placeholder="2"
							type="number"
							units="years"
							required
							min={1}
							max={10}
							parentStyles={{ backgroundColor: '#fff' }}
							onChange={(e) =>
								setDurationToRegister(e.target.value)
							}
						/>
					</div>
					<Button
						type="submit"
						variant="action"
						suffix={
							// Total cost of registration
							!gasApi.isLoading &&
							`($${parseFloat(
								commitCost + registrationCost
							).toFixed(2)})`
						}
					>
						Register
					</Button>
					<Registration
						commitCost={commitCost}
						duration={durationToRegister}
						ethPrice={ethPrice}
						name={nameToRegister}
						open={dialogOpen}
						owner={ownerToRegister}
						registrationCost={registrationCost}
						setIsOpen={setDialogOpen}
					/>
				</form>
			</div>
			<Toaster position="bottom-center" />
		</>
	)
}
