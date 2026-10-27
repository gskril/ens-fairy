# ENS Fairy

Gift an ENS name: register a `.eth` name directly to someone else's wallet.

Built for ENSv2 with [ENSjs](https://github.com/ensdomains/ensjs), [wagmi](https://wagmi.sh), [zyzz](https://zyzz.style) for styling, and [Vite](https://vite.dev), deployed as a [Cloudflare Worker](https://developers.cloudflare.com/workers/).

## How gifting works

Registrations on the ENSv2 `.eth` registrar are paid in USDC or DAI. A gift takes up to four transactions from the sender:

1. **Set up their records.** Deploys a `PermissionedResolver` proxy through the `VerifiableFactory`. The recipient is granted every resolver role, and the name's ETH address is set to the recipient during initialization, so the name resolves as soon as it's registered. The sender gets no roles.
2. **Approve** the registrar to spend the token (skipped if the allowance is already enough).
3. **Commit** to the registration, which protects it from front-running.
4. **Register** the name to the recipient after the 60 second waiting period.

With a shared [FairyResolver](#fairyresolver) configured, step 1 goes away: names point at one resolver, so a gift is just approve, commit and register.

Wallets that support atomic batching ([EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) `wallet_sendCalls`) get steps 1–3 as a single confirmation, so a gift takes two wallet interactions instead of four. The resolver address is predicted ahead of the deploy (the factory derives it from the sender and a salt), which lets the commit reference it in the same batch.

Before the first transaction, the whole sequence is simulated with `eth_simulateV1`, so a gift that would fail is caught before any gas is spent. The commit secret is saved in `localStorage`, so a reload during the wait doesn't lose the reservation.

## Development

```bash
bun install
bun dev
```

The app runs at [http://localhost:5173](http://localhost:5173) with the Worker running locally in `workerd`.

RPC requests go through the Worker at `/rpc/:chainId`, which proxies read-only `eth_*` methods. It falls back to public RPCs. To use your own, copy `.dev.vars.example` to `.dev.vars` and fill in `MAINNET_RPC_URL` and/or `SEPOLIA_RPC_URL`.

### Testing on Sepolia

Sepolia's mock USDC and DAI can be minted by anyone. When connected to Sepolia, the app shows a "get 100 test USDC" link below the form, so testing only needs Sepolia ETH.

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

## FairyResolver

[`contracts/src/FairyResolver.sol`](contracts/src/FairyResolver.sol) is an optional shared resolver for gifted names. One deployment serves every name, so a gift doesn't deploy a resolver of its own (about 267k gas saved per gift on mainnet).

- **Owner-controlled.** Only the name's current owner in the ENSv2 .eth registry, or an operator they approve, can write records. There's no admin and no upgrade path.
- **Resolves to the owner by default.** Until the owner sets one, the ETH address is the name's current owner, so a gifted name works the moment it's registered and follows the name if it's transferred.
- **Editable in the ENS manager.** Setters take the DNS-encoded name (`setAddress(bytes,uint256,bytes)`, `setText`, `setContenthash`, `clearRecords`, `multicall`), which the manager detects and writes through.
- **Basic profiles only.** It serves addresses, text records and contenthash through ENSIP-10 `resolve`, for second-level .eth names. No EAC roles.

```bash
bun run contracts:test                                 # compile + integration test against live Sepolia (eth_simulateV1)
DEPLOYER_KEY=0x... bun run contracts:deploy sepolia    # or mainnet
```

Then set `VITE_FAIRY_RESOLVER_11155111` (or `VITE_FAIRY_RESOLVER_1`) to the deployed address and rebuild. Without it, gifts deploy a per-name PermissionedResolver.

## Brand assets

`public/logo.svg` is the source for the favicon and app icons. The share image is built from `scripts/brand/og.html`; regenerate everything with `node scripts/brand/render.cjs` (needs Playwright and Pillow).
