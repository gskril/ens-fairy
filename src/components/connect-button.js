import { useDisconnect } from 'wagmi'
import { Button, Profile } from '@ensdomains/thorin'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function ConnectButtonWrapper() {
	const { disconnect } = useDisconnect()

	return (
		<ConnectButton.Custom>
			{({ account, chain, openConnectModal, mounted }) => {
				return !account || !mounted || !chain ? (
					<div>
						<Button onClick={() => openConnectModal()}>
							Connect Wallet
						</Button>
					</div>
				) : chain.unsupported ? (
					<ConnectButton />
				) : (
					<Profile
						address={account.address}
						ensName={account.ensName}
						avatar={account.ensAvatar}
						dropdownItems={[
							{
								label: `Balance: ${account.displayBalance}`,
								disabled: true,
							},
							{
								label: 'Disconnect',
								color: 'red',
								onClick: () => disconnect(),
							},
						]}
					/>
				)
			}}
		</ConnectButton.Custom>
	)
}
