import crypto from 'crypto'
import { useState, useEffect } from 'react'
import {
  Button,
  CountdownCircle,
  Dialog,
  Heading,
  Skeleton,
  Spinner,
  Typography,
} from '@ensdomains/thorin'
import {
  ensRegistrarConfig,
  ensResolver,
  ensResolverRinkeby,
} from '../lib/constants'
import toast from 'react-hot-toast'
import {
  useContractRead,
  useContractWrite,
  useNetwork,
  useProvider,
  useEnsAvatar,
  useWaitForTransaction,
} from 'wagmi'
import Confetti from 'react-confetti'
import Details from './tx-summary'
import { usePlausible } from 'next-plausible'
import useWindowSize from 'react-use/lib/useWindowSize'

export default function Registration({
  commitCost,
  duration,
  name,
  open,
  owner,
  registrationCost,
  setIsOpen,
}) {
  const plausible = usePlausible()
  const { width: windowWidth, height: windowHeight } = useWindowSize()
  const [secret] = useState(
    '0x656e736661697279' + crypto.randomBytes(24).toString('hex')
  )
  const { chain } = useNetwork()

  const provider = useProvider()
  const [resolvedOwner, setResolvedOwner] = useState()

  const ensAvatar = useEnsAvatar({
    addressOrName: open && owner,
  })

  useEffect(() => {
    async function resolveOwner() {
      const name = await provider.lookupAddress(owner)

      setResolvedOwner({
        name: name || owner.slice(0, 5) + '…' + owner.slice(-4),
        avatar: ensAvatar.data,
      })
    }

    if (open) {
      resolveOwner()
    }
  }, [ensAvatar, open, owner, provider])

  const twitterMessage = encodeURI(
    `I just registered ${name}.eth for _________ on ensfairy.xyz!`
  )

  // Contract read: make commitment
  const commitment = useContractRead({
    ...ensRegistrarConfig,
    functionName: open && 'makeCommitmentWithConfig',
    args: [
      name, // name
      owner, // owner
      secret, // secret
      chain?.id === 1 ? ensResolver : ensResolverRinkeby, // resolver
      owner, // addr
    ],
  })

  // Contract write: commit
  const commit = useContractWrite({
    ...ensRegistrarConfig,
    functionName: 'commit',
    args: commitment?.data,
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Wait for commit to settle
  const [showCountdown, setShowCountdown] = useState(false)
  const [readyToRegister, setReadyToRegister] = useState(false)
  const waitForCommit = useWaitForTransaction({
    hash: commit?.data?.hash,
    onSuccess() {
      setShowCountdown(true)
      setTimeout(() => {
        setReadyToRegister(true)
      }, 60 * 1000)
    },
  })

  // Contract read: price
  const price = useContractRead({
    ...ensRegistrarConfig,
    functionName: open && 'rentPrice',
    args: [name, duration],
    watch: true,
  })

  // Contract write: register
  const register = useContractWrite({
    ...ensRegistrarConfig,
    functionName: 'registerWithConfig',
    args: [
      name, // name
      owner, // owner
      duration, // duration
      secret, // secret
      chain?.id === 1 ? ensResolver : ensResolverRinkeby, // resolver
      owner, // addr
    ],
    overrides: {
      value: parseInt(price.data * 1.05).toString(),
      gasLimit: '300000',
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // Wait for register to settle
  const [isRegistered, setIsRegistered] = useState(false)
  const waitForRegister = useWaitForTransaction({
    hash: register?.data?.hash,
    onSuccess: (data) => {
      const didFail = data.status === 0
      if (didFail) {
        toast.error('Registration failed')
      } else {
        toast.success('Your name has been registered!')
        setIsRegistered(true)

        // Plausible Analytics
        plausible('Name Registration', {
          props: {
            name: `${name}.eth`,
            network: chain.name,
          },
        })
      }
    },
  })

  return (
    <>
      {isRegistered && (
        <Confetti
          width={windowWidth}
          height={windowHeight}
          colors={['#44BCFO', '#7298F8', '#A099FF', '#DE82FF', '#7F6AFF']}
          style={{ zIndex: '1000' }}
        />
      )}
      <Dialog
        open={open}
        className="modal"
        title={
          <Heading as="h2" align="center">
            {isRegistered ? 'Registration Complete!' : `Register ${name}.eth`}
          </Heading>
        }
        variant="actionable"
        leading={
          <>
            {!commit.data && (
              <Button
                shadowless
                variant="secondary"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            )}
            {isRegistered && (
              <Button
                shadowless
                variant="secondary"
                as="a"
                target="_blank"
                rel="noreferrer"
                href={`https://twitter.com/intent/tweet?text=${twitterMessage}`}
              >
                Share
              </Button>
            )}
          </>
        }
        trailing={
          isRegistered ? (
            // Link to ENS manager
            <Button
              as="a"
              href={`https://app.ens.domains/name/${name}.eth/details`}
              target="_blank"
              rel="noreferrer"
            >
              Open ENS Manager
            </Button>
          ) : register.data?.hash ? (
            // Link to Etherscan
            <Button
              as="a"
              href={`https://${
                chain?.id === 4 ? 'rinkeby.' : ''
              }etherscan.io/tx/${register.data.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View on Etherscan
            </Button>
          ) : readyToRegister ? (
            // Show register button
            <Button shadowless onClick={() => register.write()}>
              Register
            </Button>
          ) : commit?.data ? (
            // Show disabled waiting button after commit
            <Button shadowless disabled>
              Wait...
            </Button>
          ) : (
            // Show commit button
            <Button shadowless onClick={() => commit.write()}>
              Get Started
            </Button>
          )
        }
        onDismiss={() => {
          if (isRegistered) {
            // Refresh the page on dialog exit after a registration to fully reset state
            window.location.reload()
          } else if (commit.data) {
            return toast.error(
              'You can\'t close the dialog during registration',
              {
                style: {
                  maxWidth: '100%',
                },
              }
            )
          } else {
            setIsOpen(false)
          }
        }}
      >
        <div>
          <Typography size="base" style={{ marginBottom: '1.5rem' }}>
            {isRegistered ? (
              <>
                <p>
                  You successfully registered <strong>{name}.eth</strong> and
                  sent it to <strong>{resolvedOwner?.name}</strong>!
                </p>
                <p>
                  Name resolution is already setup, meaning you can do things
                  like send assets to the name immediately.
                </p>
              </>
            ) : (
              <p>
                Registering an ENS name is a two step process. Between the steps
                there is a 1 minute waiting period to protect your transaction
                from getting front-run.
              </p>
            )}
          </Typography>
          {!isRegistered && (
            <Details
              estimate={commitCost + registrationCost}
              name={name}
              recipient={resolvedOwner}
            />
          )}
          <Typography size="base" weight="medium">
            <ul className="steps">
              <li className="step">
                <Skeleton
                  loading={!commit.data}
                  style={{
                    borderRadius: '100%',
                    backgroundColor: !commit.data
                      ? 'rgba(0,0,0,0.15)'
                      : 'transparent',
                    lineHeight: '0',
                    width: 'min-content',
                  }}
                >
                  {waitForCommit.isLoading ? (
                    <Spinner color="accent" />
                  ) : (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 0C15.1826 0 18.2348 1.26428 20.4853 3.51472C22.7357 5.76516 24 8.8174 24 12C24 15.1826 22.7357 18.2348 20.4853 20.4853C18.2348 22.7357 15.1826 24 12 24C8.8174 24 5.76516 22.7357 3.51472 20.4853C1.26428 18.2348 0 15.1826 0 12C0 8.8174 1.26428 5.76516 3.51472 3.51472C5.76516 1.26428 8.8174 0 12 0V0ZM10.5051 14.3674L7.83943 11.7C7.74386 11.6044 7.63041 11.5286 7.50555 11.4769C7.38069 11.4252 7.24686 11.3986 7.11171 11.3986C6.97657 11.3986 6.84274 11.4252 6.71788 11.4769C6.59302 11.5286 6.47956 11.6044 6.384 11.7C6.191 11.893 6.08257 12.1548 6.08257 12.4277C6.08257 12.7007 6.191 12.9624 6.384 13.1554L9.77829 16.5497C9.87358 16.6458 9.98695 16.722 10.1118 16.774C10.2367 16.826 10.3707 16.8528 10.506 16.8528C10.6413 16.8528 10.7753 16.826 10.9002 16.774C11.0251 16.722 11.1384 16.6458 11.2337 16.5497L18.2623 9.51943C18.3591 9.42426 18.4362 9.31086 18.489 9.18577C18.5418 9.06068 18.5693 8.92637 18.5699 8.79059C18.5705 8.65482 18.5443 8.52026 18.4926 8.39468C18.441 8.26911 18.365 8.15499 18.2691 8.05893C18.1731 7.96286 18.0591 7.88675 17.9336 7.83497C17.8081 7.78319 17.6735 7.75677 17.5378 7.75725C17.402 7.75772 17.2677 7.78507 17.1425 7.83771C17.0173 7.89036 16.9039 7.96727 16.8086 8.064L10.5051 14.3674Z"
                        fill="#22C55E"
                      />
                    </svg>
                  )}
                </Skeleton>
                Commit
              </li>
              <li className="step">
                <CountdownCircle
                  countdownAmount={60}
                  disabled={!showCountdown}
                  style={{
                    marginTop: '-0.35rem',
                    marginBottom: '-0.35rem',
                    transform: 'scale(0.8)',
                    filter: showCountdown ? 'grayscale(0%)' : 'grayscale(100%)',
                  }}
                />
              </li>
              <li className="step">
                <Skeleton
                  loading={!register.data}
                  style={{
                    borderRadius: '100%',
                    backgroundColor: !register.data
                      ? 'rgba(0,0,0,0.15)'
                      : 'transparent',
                    lineHeight: '0',
                    width: 'min-content',
                  }}
                >
                  {waitForRegister.isLoading ? (
                    <Spinner color="accent" />
                  ) : waitForRegister.data?.status === 1 ? (
                    // Name registered successfully
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 0C15.1826 0 18.2348 1.26428 20.4853 3.51472C22.7357 5.76516 24 8.8174 24 12C24 15.1826 22.7357 18.2348 20.4853 20.4853C18.2348 22.7357 15.1826 24 12 24C8.8174 24 5.76516 22.7357 3.51472 20.4853C1.26428 18.2348 0 15.1826 0 12C0 8.8174 1.26428 5.76516 3.51472 3.51472C5.76516 1.26428 8.8174 0 12 0V0ZM10.5051 14.3674L7.83943 11.7C7.74386 11.6044 7.63041 11.5286 7.50555 11.4769C7.38069 11.4252 7.24686 11.3986 7.11171 11.3986C6.97657 11.3986 6.84274 11.4252 6.71788 11.4769C6.59302 11.5286 6.47956 11.6044 6.384 11.7C6.191 11.893 6.08257 12.1548 6.08257 12.4277C6.08257 12.7007 6.191 12.9624 6.384 13.1554L9.77829 16.5497C9.87358 16.6458 9.98695 16.722 10.1118 16.774C10.2367 16.826 10.3707 16.8528 10.506 16.8528C10.6413 16.8528 10.7753 16.826 10.9002 16.774C11.0251 16.722 11.1384 16.6458 11.2337 16.5497L18.2623 9.51943C18.3591 9.42426 18.4362 9.31086 18.489 9.18577C18.5418 9.06068 18.5693 8.92637 18.5699 8.79059C18.5705 8.65482 18.5443 8.52026 18.4926 8.39468C18.441 8.26911 18.365 8.15499 18.2691 8.05893C18.1731 7.96286 18.0591 7.88675 17.9336 7.83497C17.8081 7.78319 17.6735 7.75677 17.5378 7.75725C17.402 7.75772 17.2677 7.78507 17.1425 7.83771C17.0173 7.89036 16.9039 7.96727 16.8086 8.064L10.5051 14.3674Z"
                        fill="#22C55E"
                      />
                    </svg>
                  ) : (
                    // Error with registration tx
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 0C5.364 0 0 5.364 0 12C0 18.636 5.364 24 12 24C18.636 24 24 18.636 24 12C24 5.364 18.636 0 12 0ZM17.16 17.16C17.049 17.2712 16.9171 17.3595 16.772 17.4197C16.6268 17.4799 16.4712 17.5109 16.314 17.5109C16.1568 17.5109 16.0012 17.4799 15.8561 17.4197C15.7109 17.3595 15.579 17.2712 15.468 17.16L12 13.692L8.532 17.16C8.30763 17.3844 8.00331 17.5104 7.686 17.5104C7.36869 17.5104 7.06437 17.3844 6.84 17.16C6.61563 16.9356 6.48958 16.6313 6.48958 16.314C6.48958 16.1569 6.52052 16.0013 6.58065 15.8561C6.64077 15.711 6.7289 15.5791 6.84 15.468L10.308 12L6.84 8.532C6.61563 8.30763 6.48958 8.00331 6.48958 7.686C6.48958 7.36869 6.61563 7.06437 6.84 6.84C7.06437 6.61563 7.36869 6.48958 7.686 6.48958C8.00331 6.48958 8.30763 6.61563 8.532 6.84L12 10.308L15.468 6.84C15.5791 6.7289 15.711 6.64077 15.8561 6.58065C16.0013 6.52052 16.1569 6.48958 16.314 6.48958C16.4711 6.48958 16.6267 6.52052 16.7719 6.58065C16.917 6.64077 17.0489 6.7289 17.16 6.84C17.2711 6.9511 17.3592 7.08299 17.4194 7.22815C17.4795 7.37331 17.5104 7.52888 17.5104 7.686C17.5104 7.84312 17.4795 7.99869 17.4194 8.14385C17.3592 8.28901 17.2711 8.4209 17.16 8.532L13.692 12L17.16 15.468C17.616 15.924 17.616 16.692 17.16 17.16Z"
                        fill="#DC2626"
                      />
                    </svg>
                  )}
                </Skeleton>
                Register
              </li>
            </ul>
          </Typography>
        </div>
      </Dialog>

      <style jsx>{`
        .steps {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          margin: 0 auto;
          max-width: 23rem;
          gap: 0.75rem;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </>
  )
}
