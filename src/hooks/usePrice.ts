import { formatEther } from 'viem'
import { useContractRead, useNetwork } from 'wagmi'

import { TOTAL_GAS_AMOUNT, getRegistrar } from '../lib/constants'
import { parseDuration, parseName } from '../utils'
import { useFetch } from './useFetch'

interface Cost {
  name: string
  duration: string
  isConnected: boolean
}

interface CostReturn {
  rentEth: string | null
  cost: string | null
  isLoading: boolean
  isError: boolean
}

export const usePrice = ({
  name: _name,
  duration,
  isConnected,
}: Cost): CostReturn => {
  const enabled = isConnected && _name && duration ? true : false

  const { chain } = useNetwork()
  const { data: gasbest } = useFetch<any>(
    enabled ? 'https://gas.best/stats' : undefined
  )

  const gasPrice = gasbest ? (gasbest.pending.fee as number) : null
  const ethPrice = gasbest ? (gasbest.ethPrice as number) : null

  const name = parseName(_name)
  const seconds = parseDuration(duration)
  const ensRegistrarConfig = getRegistrar()

  const { data: rentPrice, isError: isRentPriceError } = useContractRead({
    ...ensRegistrarConfig,
    functionName: 'rentPrice',
    args: [name, BigInt(seconds)],
    enabled,
  })

  const rentPriceInEth = rentPrice ? formatEther(rentPrice) : null
  const gasCostInGwei = gasPrice ? gasPrice * TOTAL_GAS_AMOUNT : null
  const gasCostInEth = gasCostInGwei ? gasCostInGwei / 1e9 : null
  const finalCostEth = Number(rentPriceInEth) + Number(gasCostInEth)
  const finalCostUSD = ethPrice ? (finalCostEth * ethPrice).toFixed(2) : null

  return {
    rentEth: rentPriceInEth,
    cost: finalCostUSD ? `$${finalCostUSD.toString()}` : null,
    isLoading:
      enabled &&
      !isRentPriceError &&
      (!rentPriceInEth || !gasCostInEth || !finalCostEth),
    isError: isRentPriceError,
  }
}
