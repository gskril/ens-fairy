import { Button, Profile, mq } from '@ensdomains/thorin'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import toast from 'react-hot-toast'
import styled, { css } from 'styled-components'
import { useDisconnect } from 'wagmi'

const WiderButton = styled(Button)(
  ({ theme }) => css`
    max-width: ${theme.space['32']};

    ${mq.xs.min(css`
      max-width: ${theme.space['45']};
    `)}
  `
)

export default function ConnectButtonWrapper() {
  const { disconnect } = useDisconnect()

  const copyToClipBoard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (err) {
      console.error('Failed to copy text: ', err)
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted }) => {
        return !account || !mounted || !chain ? (
          <WiderButton shape="rounded" onClick={() => openConnectModal()}>
            Connect Wallet
          </WiderButton>
        ) : chain.unsupported ? (
          <WiderButton
            shape="rounded"
            onClick={() => openChainModal()}
            colorStyle="redPrimary"
          >
            Wrong Network
          </WiderButton>
        ) : (
          <Profile
            address={account.address}
            ensName={account.ensName}
            avatar={account.ensAvatar}
            dropdownItems={[
              {
                label: 'Copy Address',
                onClick: async () => {
                  await copyToClipBoard(account.address)
                },
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
