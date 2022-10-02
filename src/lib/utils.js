export function formatUsd(number) {
  return number.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

export function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
