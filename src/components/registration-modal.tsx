import {
  Button,
  CountdownCircle,
  Dialog,
  Heading,
  Skeleton,
  Spinner,
  Typography,
} from '@ensdomains/thorin'

import { useIsMounted } from '../hooks/useIsMounted'
import Details from './tx-summary'

type RegistrationProps = {
  open: boolean
  label: string | undefined
  recipient: `0x${string}` | undefined
  duration: number | undefined
  setIsOpen: (open: boolean) => void
}

export default function Registration({
  open,
  label,
  recipient,
  duration, // years
  setIsOpen,
}: RegistrationProps) {
  const isMounted = useIsMounted()

  if (!isMounted) return null

  console.log({ open, label, recipient, duration, setIsOpen })

  return (
    <Dialog open={open} onDismiss={() => setIsOpen(false)} variant="actionable">
      <p>testing</p>
    </Dialog>
  )
}
