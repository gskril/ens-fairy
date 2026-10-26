interface Env {
  ASSETS: Fetcher
  MAINNET_RPC_URL?: string
  SEPOLIA_RPC_URL?: string
}

const FALLBACK_RPCS: Record<string, string> = {
  '1': 'https://ethereum-rpc.publicnode.com',
  '11155111': 'https://ethereum-sepolia-rpc.publicnode.com',
}

// Only proxy read methods the app needs. Signing happens in the user's wallet.
const ALLOWED_METHOD = /^(eth_|net_version$)/

function rpcUrl(env: Env, chainId: string) {
  if (chainId === '1') return env.MAINNET_RPC_URL || FALLBACK_RPCS['1']
  if (chainId === '11155111')
    return env.SEPOLIA_RPC_URL || FALLBACK_RPCS['11155111']
  return undefined
}

async function handleRpc(request: Request, env: Env, chainId: string) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const upstream = rpcUrl(env, chainId)
  if (!upstream) return new Response('Unsupported chain', { status: 404 })

  const body = await request.text()
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const calls = Array.isArray(payload) ? payload : [payload]
  const allowed = calls.every(
    (call) =>
      typeof call === 'object' &&
      call !== null &&
      typeof (call as { method?: unknown }).method === 'string' &&
      ALLOWED_METHOD.test((call as { method: string }).method)
  )
  if (!allowed) return new Response('Method not allowed', { status: 403 })

  const res = await fetch(upstream, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })

  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'application/json' },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/rpc\/(\d+)\/?$/)

    if (match) return handleRpc(request, env, match[1])

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
