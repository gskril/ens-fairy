import { useState } from 'react'
import Confetti from 'react-confetti'
import toast from 'react-hot-toast'
import { useWindowSize } from 'react-use'
import { useEnsAvatar, useEnsName } from 'wagmi'

import { useIsMounted } from '../hooks/useIsMounted'
import { RegistrationSteps, Step } from './RegistrationSteps'
import { CardDescription, StyledDialog } from './atoms'
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
  const { width: windowWidth, height: windowHeight } = useWindowSize()

  const { data: recipientEnsName } = useEnsName({
    address: isOpen ? recipientAddress : undefined,
    chainId: 1,
  })

  const { data: recipientAvatar } = useEnsAvatar({
    name: recipientEnsName,
    chainId: 1,
  })

  if (!isMounted || !label || !recipientAddress || !duration) return null

  return (
    <>
      {step === Step.Registered && (
        <Confetti
          width={windowWidth}
          height={windowHeight}
          colors={['#44BCFO', '#7298F8', '#A099FF', '#DE82FF', '#7F6AFF']}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: '1000' }}
        />
      )}

      <StyledDialog
        open={isOpen}
        onDismiss={() => {
          if (step === 0 || step === 6) {
            setIsOpen(false)
          } else {
            toast('Keep the dialog open during registration')
          }
        }}
        variant="actionable"
        title={
          step < Step.Registered
            ? `Register ${label}.eth`
            : `Registered ${label}.eth`
        }
      >
        {step < Step.Registered ? (
          <CardDescription>
            Registering an ENS name is a two step process. Between the steps
            there is a 1 minute waiting period to protect your transaction from
            getting front-run.
          </CardDescription>
        ) : (
          <CardDescription>
            Name resolution is already setup, meaning you can do things like
            send assets to the name immediately.
          </CardDescription>
        )}

        <TxSummary
          label={label}
          recipient={{
            address: recipientAddress,
            name: recipientEnsName || undefined,
            avatar: recipientAvatar,
          }}
        />

        <RegistrationSteps
          label={label}
          recipient={recipientAddress}
          duration={duration}
          step={step}
          setStep={setStep}
        />
      </StyledDialog>
    </>
  )
}
