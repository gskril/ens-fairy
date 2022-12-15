import { BigNumber } from 'ethers'
import { formatEther } from 'ethers/lib/utils.js'
import { useContractRead } from 'wagmi'

import { ensRegistrarAddr, ensRegistrarAbi } from '../lib/constants'
import { yearsToSeconds } from '../utils'
import useFetch from './fetch'

type UsePrice = {
  name: string | undefined
  duration: number | undefined
}

type Price = {
  price: string
}

export function usePrice({ name, duration }: UsePrice): Price {
  const gasApi = useFetch('https://gas.best/stats')
  const gasPrice = gasApi.data?.pending?.fee + 1
  const ethPrice = gasApi.data?.ethPrice

  const { data, isError, isLoading } = useContractRead({
    address: name && ensRegistrarAddr,
    abi: ensRegistrarAbi,
    functionName: 'rentPrice',
    args: [name, yearsToSeconds(duration)],
    cacheOnBlock: true,
  })

  if (isError || !data || !name) {
    return { price: '' }
  }

  const priceWei = data as BigNumber
  const priceEthStr = formatEther(priceWei)
  const priceEthBeforeGas = Number(parseFloat(priceEthStr).toFixed(4))

  const commitGasAmount = 50000
  const registrationGasAmount = 300000
  const totalGasAmount = commitGasAmount + registrationGasAmount
  const priceEthOfGas = totalGasAmount * gasPrice * 0.000000001

  const totalPriceUsd = ethPrice * (priceEthBeforeGas + priceEthOfGas)
  const totalPriceUsdStr = totalPriceUsd.toFixed(2)

  return { price: '$' + totalPriceUsdStr }
}
