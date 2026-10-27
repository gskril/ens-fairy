/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Shared FairyResolver address on mainnet, if deployed */
  readonly VITE_FAIRY_RESOLVER_1?: string
  /** Shared FairyResolver address on Sepolia, if deployed */
  readonly VITE_FAIRY_RESOLVER_11155111?: string
}
