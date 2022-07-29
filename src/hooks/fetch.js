import useSWR from 'swr'

const fetcher = (...args) => fetch(...args).then((res) => res.json())

export default function useFetch(...args) {
  const { data, error } = useSWR(...args, fetcher, {
    refreshInterval: 1000 * 30,
  })

  return {
    data: data,
    isLoading: !error && !data,
    isError: error,
  }
}
