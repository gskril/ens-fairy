import Link from 'next/link'
import { Heading } from '@ensdomains/thorin'
import ConnectButtonWrapper from '../components/connect-button'

export default function Header({ position }) {
  return (
    <header className={['header', [position && `header--${position}`]].join(' ')}>
      <Link href="/">
        <a>
          <Heading as="span" level="2" className="header__name">
            ENS Fairy
          </Heading>
        </a>
      </Link>
      <ConnectButtonWrapper />
    </header>
  )
}
