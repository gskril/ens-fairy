import toast from 'react-hot-toast'
import { parseAbi, parseUnits } from 'viem'
import { useConnection, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { style } from 'zyzz'

import {
  PAYMENT_TOKENS,
  type PaymentToken,
  getErrorMessage,
  getPaymentTokenAddress,
} from '../lib/gift'
import { config, sepolia } from '../lib/wagmi'
import { Spinner } from './ui'

const mintAbi = parseAbi(['function mint(address to, uint256 amount)'])

/** Sepolia's mock payment tokens can be minted by anyone, for testing. */
export function TestnetFaucet({ token }: { token: PaymentToken }) {
  const { address } = useConnection()
  const { mutateAsync, isPending } = useWriteContract()
  const { symbol, decimals } = PAYMENT_TOKENS[token]

  async function mint() {
    if (!address) return
    try {
      const hash = await mutateAsync({
        chainId: sepolia.id,
        address: getPaymentTokenAddress(sepolia, token),
        abi: mintAbi,
        functionName: 'mint',
        args: [address, parseUnits('100', decimals)],
      })
      await toast.promise(
        waitForTransactionReceipt(config, { hash, chainId: sepolia.id }),
        {
          loading: `Minting 100 test ${symbol}…`,
          success: `Minted 100 test ${symbol}`,
          error: 'Mint failed',
        }
      )
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <button
      type="button"
      onClick={mint}
      disabled={isPending}
      {...styles.faucet()}
    >
      {isPending && <Spinner size={12} />}
      Testnet: get 100 test {symbol}
    </button>
  )
}

namespace styles {
  export const faucet = style({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    alignSelf: 'center',
    padding: '0.25rem 0.5rem',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    fontSize: '0.875rem',
    cursor: 'pointer',
    ':hover': { color: 'var(--blue)' },
  })
}
