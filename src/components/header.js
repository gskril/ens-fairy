import { Heading } from '@ensdomains/thorin'
import ConnectButtonWrapper from '../components/connect-button'

export default function Header() {
	return (
		<header className="header">
			<Heading as="span" level="2" className="header__name">
				ENS Fairy
			</Heading>
			<ConnectButtonWrapper />
		</header>
	)
}
