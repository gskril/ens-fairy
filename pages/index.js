import Head from 'next/head'
import { Input } from '@ensdomains/thorin'
import { Button } from '@ensdomains/thorin'
import { Heading } from '@ensdomains/thorin'
import { Typography } from '@ensdomains/thorin'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function Home() {
	return (
		<>
			<Head>
				<title>ENS Fairy</title>
			</Head>
			<header className="header">
				<Typography as="span" variant="extraLarge" weight="bold">
					ENS Fairy
				</Typography>
				<ConnectButton showBalance={false} />
			</header>
			<div className="container">
				<Heading
					as="h1"
					align="center"
					style={{ marginBottom: '2rem' }}
				>
					Register an ENS name directly to another address
				</Heading>
				<form className="form">
					<div className="col">
						<Input
							label="Name"
							placeholder="gregskril.eth"
							maxLength="42"
							required
							spellCheck="false"
							style={{ backgroundColor: '#fff' }}
							parentStyles={{ overflow: 'hidden' }}
						/>
						<Input
							label="Owner"
							placeholder="0xA0Cf…251e"
							maxLength="42"
							required
							spellCheck="false"
							style={{ width: '20rem', backgroundColor: '#fff' }}
							parentStyles={{ overflow: 'hidden' }}
						/>
						<Input
							label="Duration"
							placeholder="2"
							type="number"
							units="years"
							required
							min={1}
							max={10}
							style={{ backgroundColor: '#fff' }}
							parentStyles={{ overflow: 'hidden' }}
						/>
					</div>
					<Button type="submit" variant="action">
						Register
					</Button>
				</form>
			</div>
		</>
	)
}
