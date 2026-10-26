# ENS Fairy

Gift an ENS name: register a `.eth` name directly to someone else's wallet.

Built for ENSv2 with [ENSjs](https://github.com/ensdomains/ensjs), [wagmi](https://wagmi.sh), [zyzz](https://zyzz.style) for styling, and [Vite](https://vite.dev), deployed as a [Cloudflare Worker](https://developers.cloudflare.com/workers/).

## How gifting works

Registrations on the ENSv2 `.eth` registrar are paid in USDC or DAI. A gift takes up to four transactions from the sender:

1. **Set up their records.** Deploys a `PermissionedResolver` proxy through the `VerifiableFactory`. The recipient is granted every resolver role, and the name's ETH address is set to the recipient during initialization, so the name resolves as soon as it's registered. The sender gets no roles.
2. **Approve** the registrar to spend the token (skipped if the allowance is already enough).
3. **Commit** to the registration, which protects it from front-running.
4. **Register** the name to the recipient after the 60 second waiting period.

Before the first transaction, the whole sequence is simulated with `eth_simulateV1`, so a gift that would fail is caught before any gas is spent. The commit secret is saved in `localStorage`, so a reload during the wait doesn't lose the reservation.

## Development

```bash
bun install
bun dev
```

The app runs at [http://localhost:5173](http://localhost:5173) with the Worker running locally in `workerd`.

RPC requests go through the Worker at `/rpc/:chainId`, which proxies read-only `eth_*` methods. It falls back to public RPCs. To use your own, copy `.dev.vars.example` to `.dev.vars` and fill in `MAINNET_RPC_URL` and/or `SEPOLIA_RPC_URL`.

### Checking that registrations work

```bash
bun run check          # mainnet
bun run check sepolia  # needs CHECK_ACCOUNT set to an address holding test USDC
```

This dry-runs a full gift against live chain state and reports whether it would succeed.

## Deployment

```bash
bunx wrangler secret put MAINNET_RPC_URL   # optional
bunx wrangler secret put SEPOLIA_RPC_URL   # optional
bun run deploy
```
