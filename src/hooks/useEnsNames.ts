import { useFetch } from './useFetch'

const getEndpoint = (chainId?: number) => {
  if (chainId === 5) {
    return 'https://api.thegraph.com/subgraphs/name/ensdomains/ensgoerli'
  } else {
    return 'https://api.thegraph.com/subgraphs/name/ensdomains/ens'
  }
}

export type Domain = {
  id: string
  labelName: string
  labelhash: string
  name: string
  owner: {
    id: string
  }
}

type GraphResponse = {
  data: {
    domains: Array<Domain>
  }
}

export function useEnsNames(address: string | undefined, chainId?: number) {
  // TODO: add support for wrapped names (would need to handle ERC1155 tokens)
  const query = `
    {
      domains(
        first: 100
        where: { 
          owner: "${address?.toLowerCase()}"
          labelName_not: null
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

  return {
    data: response.data?.data.domains,
    error: response.error,
    isLoading: address && !response.data && !response.error,
  }
}
