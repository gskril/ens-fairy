import { Button, mq } from '@ensdomains/thorin'
import Link from 'next/link'
import styled, { css } from 'styled-components'

import { Columns } from './atoms'
import ConnectButtonWrapper from './connect-button'
import { EnsLogo, EnsLogoShort } from './icons'

const ShortLogoWrapper = styled.div`
  display: flex;

  ${mq.sm.min(css`
    display: none;
  `)}

  ${mq.xs.max(css`
    width: 2.25rem;
  `)}
`

const FullLogoWrapper = styled.div`
  display: flex;

  ${mq.sm.max(css`
    display: none;
  `)}
`

export function Nav() {
  return (
    <Columns>
      <Link href="/">
        <a>
          <ShortLogoWrapper>
            <EnsLogoShort />
          </ShortLogoWrapper>

          <FullLogoWrapper>
            <EnsLogo />
          </FullLogoWrapper>
        </a>
      </Link>

      <ConnectButtonWrapper />
    </Columns>
  )
}
