import { useFetch } from './useFetch'

const getEndpoint = (chainId?: number) => {
  if (chainId === 5) {
    return 'https://api.thegraph.com/subgraphs/name/ensdomains/ensgoerli'
  } else {
    return 'https://api.thegraph.com/subgraphs/name/ensdomains/ens'
  }
}

type Domain = {
  id: string
  labelName: string
  labelhash: string
  name: string
  owner: {
    id: string
  }
}

type WrappedDomain = Omit<Domain, 'labelName' | 'labelhash'>

type GraphResponse = {
  data: {
    domains: Array<Domain>
    wrappedDomains: Array<WrappedDomain>
  }
}

export type NormalizeDomain = WrappedDomain & {
  tokenId: bigint
  wrapped: boolean
}

export function useEnsNames(address: string | undefined, chainId?: number) {
  const currentUnixTime = Math.floor(Date.now() / 1000)

  // TODO: add support for wrapped names (would need to handle ERC1155 tokens)
  const query = `
    {
      domains(
        first: 100
        where: { 
          registrant: "${address?.toLowerCase()}"
          labelName_not: null
          expiryDate_gt: ${currentUnixTime}
        }
      ) {
        id
        labelName
        labelhash
        name
        owner {
          id
        }
      }

      wrappedDomains(
        first: 100
        where: { 
          owner: "${address?.toLowerCase()}"
        }
      ) {
        id
        name
        owner {
          id
        }
      }
    }
  `

  // Only make the request if an address is provided
  const response = useFetch<GraphResponse>(
    address ? getEndpoint(chainId) : undefined,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  )

  const normalizedDomains: NormalizeDomain[] | undefined =
    response.data?.data.domains.map((domain) => ({
      id: domain.id,
      tokenId: BigInt(domain.labelhash),
      name: domain.name,
      owner: { ...domain.owner },
      wrapped: false,
    }))

  const normalizedWrappedDomains: NormalizeDomain[] | undefined =
    response.data?.data.wrappedDomains.map((domain) => ({
      ...domain,
      tokenId: BigInt(domain.id),
      wrapped: true,
    }))

  const allDomains = normalizedDomains?.concat(normalizedWrappedDomains || [])

  return {
    data: allDomains,
    error: response.error,
    isLoading: address && !response.data && !response.error,
  }
}
