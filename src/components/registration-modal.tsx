import { Dialog, mq } from '@ensdomains/thorin'
import { useState } from 'react'
import styled, { css } from 'styled-components'
import { useEnsAvatar, useEnsName } from 'wagmi'

import { useIsMounted } from '../hooks/useIsMounted'
import { shortenAddress } from '../utils'
import { RegistrationSteps, Step } from './RegistrationSteps'
import { CardDescription } from './atoms'
import TxSummary from './tx-summary'

type RegistrationProps = {
  open: boolean
  label: string | undefined
  recipient: `0x${string}` | undefined
  duration: number | undefined
  setIsOpen: (open: boolean) => void
}

export default function Registration({
  open: isOpen,
  label,
  recipient: recipientAddress, // address
  duration, // years
  setIsOpen,
}: RegistrationProps) {
  const isMounted = useIsMounted()
  const [step, setStep] = useState<Step>(0)

  const { data: recipientEnsName } = useEnsName({
    address: isOpen ? recipientAddress : undefined,
    chainId: 1,
  })

  const { data: recipientAvatar } = useEnsAvatar({
    name: recipientEnsName,
    chainId: 1,
  })

  if (!isMounted || !label || !recipientAddress || !duration) return null

  // prettier-ignore
  const recipientDisplayName = recipientEnsName || shortenAddress(recipientAddress)

  return (
    <StyledDialog
      open={isOpen}
      onDismiss={() => setIsOpen(false)}
      variant="actionable"
      title={`Register ${label}.eth`}
    >
      <CardDescription>
        Registering an ENS name is a two step process. Between the steps there
        is a 1 minute waiting period to protect your transaction from getting
        front-run.
      </CardDescription>

      <TxSummary
        label={label}
        recipient={{ display: recipientDisplayName, avatar: recipientAvatar }}
      />

      <RegistrationSteps
        label={label}
        recipient={recipientAddress}
        duration={duration}
        step={step}
        setStep={setStep}
      />
    </StyledDialog>
  )
}

const StyledDialog = styled(Dialog)(
  ({ theme }) => css`
    width: 100%;

    ${mq.sm.min(css`
      max-width: ${theme.space['112']};
    `)}

    & > div > div {
      width: 100%;
    }
  `
)
