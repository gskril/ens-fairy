import { formatAddress } from '../lib/utils'
import { Typography } from '@ensdomains/thorin'
import { useEffect, useState } from 'react'
import { useQuery } from 'wagmi'
import Image from 'next/image'
import styled, { css } from 'styled-components'

const Profile = styled.div(
  ({ theme }) => css`
    background: linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.35),
        rgba(255, 255, 255, 0.35)
      ),
      ${theme.colors.gradients.blue};
    max-width: 27rem;
    border: 2px solid rgba(141, 159, 220, 0.1);
    border-radius: ${theme.radii.large};
    padding: ${theme.space[5]};
    box-shadow: 2px 4px 16px -4px rgba(108, 145, 202, 0.65);
  `
)

const ProfileBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const ProfileTop = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`

const NameAddress = styled.div(
  ({ theme }) => css`
    display: flex;
    gap: ${theme.space[1]};
    flex-direction: column;

    .name {
      font-weight: ${theme.fontWeights.bold};
      font-size: 1.5rem;
    }

    .address {
      font-weight: ${theme.fontWeights.normal};
      font-size: 0.875rem;
    }
  `
)

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
      <Profile>
        <ProfileBody>
          <ProfileTop>
            <Image
              src={
                records.avatar
                  ? `http://metadata.ens.domains/mainnet/avatar/${records.name}`
                  : '/av-default.jpg'
              }
              width={58}
              height={58}
              alt=""
              style={{
                borderRadius: '0.5rem',
                boxShadow: '1px 1px 6px -2px rgba(27, 31, 35, 0.25)',
              }}
            />
            <NameAddress>
              <span className="name">{records.name}</span>
              <span className="address">{formatAddress(address)}</span>
            </NameAddress>
          </ProfileTop>
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
        </ProfileBody>
      </Profile>
    )
}
