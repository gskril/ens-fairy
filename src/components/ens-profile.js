import { formatAddress } from '../lib/utils'
import { Typography } from '@ensdomains/thorin'
import { useEffect, useState } from 'react'
import { useQuery } from 'wagmi'
import Image from 'next/image'

export default function EnsProfile({ address }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Get ENS text records
  const { data: records } = useQuery(
    ['records', address],
    () =>
      fetch(`https://ens-records.vercel.app/${address}?avatar`).then((res) =>
        res.json()
      ),
    {
      enabled: !!address,
    }
  )

  if (mounted && records)
    return (
      <div className="container">
        <div className="banner" />
        <div className="body">
          <div className="top">
            <Image
              src={
                records.avatar
                  ? `http://metadata.ens.domains/mainnet/avatar/${records.name}`
                  : '/av-default.jpg'
              }
              width={24}
              height={24}
              alt=""
            />
            <div className="name-address">
              <span className="name">{records.name}</span>
              <span className="address">{formatAddress(address)}</span>
            </div>
          </div>
          <Typography>{records.description}</Typography>
          <div className="meta">
            <div className="meta-item">
              {records.twitter && (
                <a
                  href={`https://twitter.com/${records.twitter}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Twitter
                </a>
              )}
              {records.github && (
                <a
                  href={`https://github.com/${records.github}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Github
                </a>
              )}
              {records.url && (
                <a href={records.url} target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    )
}
