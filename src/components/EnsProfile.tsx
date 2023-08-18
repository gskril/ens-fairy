import { Typography } from '@ensdomains/thorin'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import styled, { css } from 'styled-components'
import { useQuery } from 'wagmi'

import { shortenAddress } from '../utils'
import { TwitterIcon, GithubIcon } from './icons'

const Profile = styled.div(
  ({ theme }) => css`
    background: linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.35),
        rgba(255, 255, 255, 0.35)
      ),
      ${theme.colors.gradients.blue};
    max-width: 27rem;
    border-radius: ${theme.radii.large};
    padding: ${theme.space[5]};
    box-shadow: 2px 4px 16px -4px rgba(108, 145, 202, 0.65);
    border: 2px solid #a2bdfa;
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

const Avatar = styled.div`
  border-radius: 0.5rem;
  overflow: hidden;
  background: red;
  box-shadow: 1px 1px 6px -2px rgba(27, 31, 35, 0.25);
  line-height: 0;
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

const Description = styled(Typography)(
  ({ theme }) => css`
    color: ${theme.colors.textSecondary};
    line-height: 1.4;
  `
)

const SocialTags = styled.div`
  display: flex;
  gap: 0.75rem;
`

const SocialTag = styled.a`
  display: flex;
  background-color: #719fe0;
  padding: 0.5rem;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #6a9bde;
  flex-direction: row;
  align-items: center;
  font-size: 0.875rem;
  color: #fff;
  gap: 0.5rem;
  transition: all 0.1s ease-in-out;

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    background-color: #5a86c4;
    outline: none;
  }
`

export function EnsProfile({ address }: { address: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Get ENS text records
  const { data: records } = useQuery(
    ['records', address],
    () =>
      fetch(`https://api.gregskril.com/ens-profile/${address}`).then((res) =>
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
            <Avatar>
              <Image
                src={
                  records.avatar
                    ? `http://metadata.ens.domains/mainnet/avatar/${records.name}`
                    : '/av-default.jpg'
                }
                width={58}
                height={58}
                alt=""
              />
            </Avatar>
            <NameAddress>
              <span className="name">{records.name}</span>
              <span className="address">{shortenAddress(address)}</span>
            </NameAddress>
          </ProfileTop>
          <Description as="p">{records.records?.description}</Description>
          <SocialTags>
            <SocialTag
              href={`https://twitter.com/${records.records?.twitter}`}
              target="_blank"
              rel="noreferrer"
            >
              <TwitterIcon />
              {records.twitter && <span>Twitter</span>}
            </SocialTag>
            <SocialTag
              href={`https://github.com/${records.records?.github}`}
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon />
              {records.records?.github && <span>GitHub</span>}
            </SocialTag>
          </SocialTags>
        </ProfileBody>
      </Profile>
    )

  return null
}
