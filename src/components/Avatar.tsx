import { useState } from 'react'
import { style } from 'zyzz'

import { mainnet } from '../lib/wagmi'

function avatarUrl(name: string, chainId: number) {
  const network = chainId === mainnet.id ? 'mainnet' : 'sepolia'
  return `https://metadata.ens.domains/${network}/avatar/${name}`
}

export function Avatar({
  name,
  chainId,
  size = 36,
}: {
  name?: string
  chainId: number
  size?: number
}) {
  const [failed, setFailed] = useState<string>()
  const showImage = name && failed !== name

  return (
    <span {...styles.avatar({ style: { width: size, height: size } })}>
      {showImage && (
        <img
          src={avatarUrl(name, chainId)}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(name)}
          {...styles.image()}
        />
      )}
    </span>
  )
}

export const shortenAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`

namespace styles {
  export const avatar = style({
    display: 'inline-flex',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '50%',
    backgroundImage: 'var(--gradient)',
    boxShadow: '1px 2px 4px rgba(0, 0, 0, 0.1)',
  })

  export const image = style({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  })
}
