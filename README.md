# ENS Fairy

Gift an ENS name: register a `.eth` name directly to someone else's wallet.

Built for ENSv2 with [ENSjs](https://github.com/ensdomains/ensjs), [wagmi](https://wagmi.sh), [zyzz](https://zyzz.style) for styling, and [Vite](https://vite.dev), deployed as a [Cloudflare Worker](https://developers.cloudflare.com/workers/).

## How gifting works

Registrations on the ENSv2 `.eth` registrar are paid in USDC or DAI. Every gifted name points at the shared [FairyResolver](#fairyresolver), which resolves the name to its owner until they set records, so a gift takes up to three transactions from the sender:

1. **Approve** the registrar to spend the token (skipped if the allowance is already enough).
2. **Commit** to the registration, which protects it from front-running.
3. **Register** the name to the recipient after the 60 second waiting period.

Wallets that support atomic batching ([EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) `wallet_sendCalls`) get steps 1–2 as a single confirmation, so a gift takes two wallet interactions.

Before the first transaction, the whole sequence is simulated with `eth_simulateV1`, so a gift that would fail is caught before any gas is spent. The commit secret is saved in `localStorage`, so a reload during the wait doesn't lose the reservation.

## Development

```bash
bun install
bun dev
```

The app runs at [http://localhost:5173](http://localhost:5173) with the Worker running locally in `workerd`.

### Configuration

FairyResolver addresses are hardcoded per chain in [`src/lib/contracts.ts`](src/lib/contracts.ts). A chain left at the zero address shows a "down for maintenance" screen instead of the form.

The Worker reads two optional secrets, `MAINNET_RPC_URL` and `SEPOLIA_RPC_URL`, and falls back to [PublicNode](https://publicnode.com) RPCs without them.

Security headers, including the Content Security Policy, are set in [`public/_headers`](public/_headers). `connect-src` and `img-src` allow any https origin because ENS resolution can call arbitrary CCIP Read gateways and avatars can live on any host.

RPC requests go through the Worker at `/rpc/:chainId`, which proxies read-only `eth_*` methods. To use your own RPCs, copy `.dev.vars.example` to `.dev.vars` locally, and use `wrangler secret put` in production.

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

[`contracts/src/FairyResolver.sol`](contracts/src/FairyResolver.sol) is the shared resolver every gifted name points at. One deployment serves every name, so a gift doesn't deploy a resolver of its own.

- **A v2 resolver.** It implements the same `IRecordResolver` interface as ENSv2's `PermissionedResolver`: name-based setters (`setAddress`, `setText`, `setContenthash`, `setData`, `setABI`, `setInterface`, `setName`, `multicall`), the same `resolve` profiles (including resolve-multicall and the ENSIP-19 default address), and the same `Linked` / `*Updated(recordId, …)` / `Cleared` events, so the ENS manager and v2 indexers treat it like any other v2 resolver. Record IDs are derived from the registration rather than stored, so `Linked` is emitted on every write. It has no EAC roles.
- **Owner-controlled.** Records can be written by the name's current owner in the ENSv2 .eth registry, or by accounts the owner approves here, as in `PublicResolverV2`: an operator for all their names (`setApprovalForAll`) or a delegate for one (`approve`). Approvals belong to the owner, so they stop applying when a name changes hands. There's no admin and no upgrade path.
- **Resolves to the owner by default.** Until the owner sets one, the ETH address is the name's current owner, so a gifted name works the moment it's registered and follows the name if it's transferred.
- **Records belong to a registration.** Each registration gets its own record, found through the registry's resource ID, which changes when a name is registered again. If a name expires and someone else registers it, they start clean. Transfers and renewals keep records. `clearRecords` starts the record over.
- **Second-level .eth names only.**

It's a [Foundry](https://getfoundry.sh) project that builds on ENS's own code: [contracts-v2](https://github.com/ensdomains/contracts-v2) is a submodule pinned to `v2-mainnet-deployment-1`, and the resolver profile interfaces, `NameCoder`, `ENSIP19` and the registry interfaces all come from it (and the ens-contracts and OpenZeppelin versions it pins).

```bash
git submodule update --init --recursive   # first time only
cd contracts
forge build
forge test                                # forks Sepolia: real registrations, resolved through the Universal Resolver
```

Tests fork Sepolia over `SEPOLIA_RPC_URL`, falling back to PublicNode. The `mainnet` and `sepolia` RPC aliases in `foundry.toml` also point at PublicNode; pass `--rpc-url $SEPOLIA_RPC_URL` to use your own. To deploy:

```bash
forge script script/DeployFairyResolver.s.sol --rpc-url sepolia --broadcast --skip-simulation --account <keystore>   # or mainnet
```

The script deploys with CREATE2 through the [deterministic deployment proxy](https://github.com/Arachnid/deterministic-deployment-proxy), so FairyResolver gets the same address on mainnet and Sepolia. The contract picks the chain's .eth registry itself, which keeps its creation code identical across chains, and the metadata hash is left out of the bytecode so comment changes don't move the address. Code changes do, so deploy both chains from the same commit. Re-running the script on a chain where it's already deployed does nothing. Keep `--skip-simulation`: forge's local simulation underprices code deposits on Sepolia's newer gas schedule (the deploy needs ~20M gas there), and without it the deploy runs out of gas.

Then set that chain's address in [`src/lib/contracts.ts`](src/lib/contracts.ts). Until it's set, that chain shows the maintenance screen.

## Brand assets

`public/logo.svg` is the source for the favicon and app icons. The share image is built from `scripts/brand/og.html`; regenerate everything with `node scripts/brand/render.cjs` (needs Playwright and Pillow).
