import { randomSecret } from '@ensdomains/ensjs/utils'
import { commitName, registerName } from '@ensdomains/ensjs/wallet'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Account,
  type Address,
  type Client,
  type Hash,
  type Hex,
  type Transport,
  erc20Abi,
  getAddress,
  isAddress,
} from 'viem'
import {
  getCapabilities,
  getConnectorClient,
  getPublicClient,
  readContract,
  sendCalls,
  simulateContract,
  waitForCallsStatus,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions'

import { getFairyResolver } from '../lib/contracts'
import {
  type EnsChain,
  PAYMENT_TOKENS,
  type PaymentToken,
  dryRunGift,
  formatTokenAmount,
  getErrorMessage,
  getGiftCalls,
  getGiftPrice,
  getPaymentTokenAddress,
  getRegisterWriteParameters,
  getRegistrarAddress,
  getRevertError,
  yearsToSeconds,
} from '../lib/gift'
import { type SupportedChainId, config } from '../lib/wagmi'

export type GiftParams = {
  chainId: SupportedChainId
  label: string
  recipient: Address
  years: number
  token: PaymentToken
}

export type StepId = 'approve' | 'commit' | 'wait' | 'register'
export type Phase = 'idle' | StepId | 'done'
export type TxStatus = 'sign' | 'confirm'

export type GiftState = {
  phase: Phase
  txStatus?: TxStatus
  error?: string
  /** Unix ms timestamp for when the commitment can be revealed */
  readyAt?: number
  /** True once the wait is over and the register tx can be sent */
  ready?: boolean
  approvalSkipped?: boolean
  /** True while the gift is being simulated before any transactions */
  checking?: boolean
  /** True when approval and commit are sent as one wallet batch */
  batched?: boolean
  hashes: Partial<Record<StepId, Hash>>
}

/** Saved between page loads so a refresh mid-flow doesn't waste the commit */
type Draft = {
  secret: Hex
  /** The resolver the commitment was made with */
  resolver: Address
  /** EIP-5792 batch id, while a batched setup is in flight */
  batchId?: string
  commitHash?: Hash
}

/**
 * Whether the connected wallet can run calls atomically (EIP-5792). Only
 * `supported` counts, matching the official ENS apps: `ready` means sending a
 * batch would prompt an EIP-7702 upgrade of the user's account, which a gift
 * shouldn't trigger.
 */
async function supportsAtomicBatch(chainId: SupportedChainId) {
  try {
    const capabilities = await getCapabilities(config, { chainId })
    return capabilities.atomic?.status === 'supported'
  } catch {
    return false
  }
}

const STEP_ORDER: Phase[] = [
  'idle',
  'approve',
  'commit',
  'wait',
  'register',
  'done',
]

export function stepStatus(state: GiftState, step: StepId) {
  const current = STEP_ORDER.indexOf(state.phase)
  const index = STEP_ORDER.indexOf(step)
  if (step === 'approve' && state.approvalSkipped && current > index) {
    return 'skipped'
  }
  if (current > index) return 'done'
  if (current === index) return state.error ? 'error' : 'active'
  return 'pending'
}

const DRAFT_PREFIX = 'ens-fairy:gift:'

function draftKey({ chainId, label, recipient, years, token }: GiftParams) {
  return `${DRAFT_PREFIX}${chainId}:${label}:${recipient.toLowerCase()}:${years}:${token}`
}

/**
 * Gifts on `chainId` that were committed (or sent as a batch) in an earlier
 * visit, so they can be resumed without re-entering the form. Read from the
 * saved draft keys.
 */
export function findPendingGifts(chainId: number): GiftParams[] {
  const gifts: GiftParams[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      const parts = key.slice(DRAFT_PREFIX.length).split(':')
      if (parts.length !== 5) continue
      const [id, label, recipient, years, token] = parts
      if (Number(id) !== chainId || !(token in PAYMENT_TOKENS)) continue
      if (!isAddress(recipient)) continue

      const draft = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft
      if (!draft?.commitHash && !draft?.batchId) continue

      gifts.push({
        chainId: chainId as SupportedChainId,
        label,
        recipient: getAddress(recipient),
        years: Number(years),
        token: token as PaymentToken,
      })
    }
  } catch {
    // Storage can be unavailable (private mode)
  }
  return gifts
}

function loadDraft(params: GiftParams): Draft | undefined {
  try {
    const raw = localStorage.getItem(draftKey(params))
    return raw ? (JSON.parse(raw) as Draft) : undefined
  } catch {
    return undefined
  }
}

function saveDraft(params: GiftParams, draft: Draft | undefined) {
  try {
    if (draft) localStorage.setItem(draftKey(params), JSON.stringify(draft))
    else localStorage.removeItem(draftKey(params))
  } catch {
    // Storage can be unavailable (private mode). The flow still works.
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useGiftFlow(params: GiftParams | undefined) {
  const [state, setState] = useState<GiftState>({ phase: 'idle', hashes: {} })
  const running = useRef(false)
  const mounted = useRef(true)

  const update = useCallback((next: Partial<GiftState>) => {
    if (mounted.current) setState((prev) => ({ ...prev, ...next }))
  }, [])

  const setHash = useCallback((step: StepId, hash: Hash) => {
    if (mounted.current) {
      setState((prev) => ({
        ...prev,
        hashes: { ...prev.hashes, [step]: hash },
      }))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const getDraft = useCallback(() => {
    if (!params) throw new Error('Missing gift details')
    let draft = loadDraft(params)
    if (!draft) {
      const resolver = getFairyResolver(params.chainId)
      if (!resolver) throw new Error('Gifting is paused on this network')
      draft = { secret: randomSecret(), resolver }
      saveDraft(params, draft)
    }
    return draft
  }, [params])

  const getClients = useCallback(async () => {
    if (!params) throw new Error('Missing gift details')
    const wallet = (await getConnectorClient(config, {
      chainId: params.chainId,
    })) as Client<Transport, EnsChain, Account>
    const client = getPublicClient(config, {
      chainId: params.chainId,
    }) as Client<Transport, EnsChain>
    return { wallet, client }
  }, [params])

  const registrationParams = useCallback(
    (draft: Draft) => {
      if (!params) throw new Error('Missing gift details')
      return {
        label: params.label,
        owner: params.recipient,
        duration: yearsToSeconds(params.years),
        secret: draft.secret,
        resolverAddress: draft.resolver,
      }
    },
    [params]
  )

  /** Waits for a setup batch and records the commit it made. */
  const finishBatch = useCallback(
    async (draft: Draft, id: string) => {
      if (!params) return
      const result = await waitForCallsStatus(config, {
        id,
        timeout: 15 * 60_000,
      })
      const last = result.receipts?.at(-1)
      draft.batchId = undefined

      if (result.status !== 'success' || !last) {
        saveDraft(params, draft)
        throw new Error('The wallet batch failed')
      }

      draft.commitHash = last.transactionHash
      saveDraft(params, draft)
    },
    [params]
  )

  /** Polls until the registrar accepts the commitment. */
  const waitUntilReady = useCallback(
    async (draft: Draft) => {
      if (!params) return
      const { wallet } = await getClients()
      update({ phase: 'wait', txStatus: undefined, error: undefined })

      const register = getRegisterWriteParameters(wallet, {
        ...registrationParams(draft),
        paymentToken: getPaymentTokenAddress(wallet.chain, params.token),
      })

      while (mounted.current) {
        try {
          await simulateContract(config, {
            address: register.address,
            abi: register.abi,
            functionName: register.functionName,
            args: register.args,
            chainId: params.chainId,
            account: wallet.account.address,
          })
          update({ ready: true, readyAt: Date.now() })
          return
        } catch (err) {
          const revert = getRevertError(err)

          if (revert?.name === 'CommitmentTooNew') {
            const [, validFrom, blockTimestamp] = revert.args as [
              Hex,
              bigint,
              bigint,
            ]
            const waitMs = Number(validFrom - blockTimestamp) * 1000 + 1500
            update({ readyAt: Date.now() + waitMs })
            await sleep(Math.max(waitMs, 3000))
            continue
          }

          if (revert?.name === 'CommitmentTooOld') {
            saveDraft(params, undefined)
          }

          throw err
        }
      }
    },
    [getClients, params, registrationParams, update]
  )

  /**
   * Approves the registrar again if its allowance dropped after the commit,
   * e.g. another gift spent it or it was revoked. A no-op otherwise.
   */
  const topUpAllowance = useCallback(async () => {
    if (!params) return
    const { wallet, client } = await getClients()
    const token = getPaymentTokenAddress(wallet.chain, params.token)
    const registrar = getRegistrarAddress(wallet.chain)
    const { total } = await getGiftPrice(client, params)
    const allowance = await readContract(config, {
      chainId: params.chainId,
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [wallet.account.address, registrar],
    })
    if (allowance >= total) return

    update({ txStatus: 'sign' })
    const hash = await writeContract(config, {
      chainId: params.chainId,
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [registrar, total],
    })
    update({ txStatus: 'confirm' })
    const receipt = await waitForTransactionReceipt(config, {
      hash,
      chainId: params.chainId,
    })
    if (receipt.status !== 'success') throw new Error('Approval failed')
    update({ txStatus: undefined })
  }, [getClients, params, update])

  /** Runs every step up to the waiting period, resuming saved progress. */
  const start = useCallback(async () => {
    if (!params || running.current) return
    running.current = true
    update({ error: undefined })

    try {
      const { wallet, client } = await getClients()
      const account = wallet.account.address
      const token = getPaymentTokenAddress(wallet.chain, params.token)
      const registrar = getRegistrarAddress(wallet.chain)
      const draft = getDraft()
      const setup = {
        ...params,
        account,
        secret: draft.secret,
        resolverAddress: draft.resolver,
      }

      // A batch that was sent before a reload: wait for it to finish
      if (draft.batchId && !draft.commitHash) {
        update({ batched: true, phase: 'commit', txStatus: 'confirm' })
        await finishBatch(draft, draft.batchId)
      }

      if (!draft.commitHash) {
        const price = await getGiftPrice(client, params)
        const balance = await readContract(config, {
          chainId: params.chainId,
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        })

        if (balance < price.total) {
          const { symbol } = PAYMENT_TOKENS[params.token]
          throw new Error(
            `You need ${formatTokenAmount(price.total, params.token)} ${symbol} to register this name`
          )
        }

        // Simulate the whole gift first so nobody pays gas for a doomed attempt
        update({ checking: true })
        let failure: unknown
        try {
          failure = await dryRunGift(client, setup)
        } catch (err) {
          // Not every RPC supports eth_simulateV1. Carry on without it.
          console.warn('Skipping gift simulation', err)
        } finally {
          update({ checking: false })
        }
        if (failure) throw failure

        const allowance = await readContract(config, {
          chainId: params.chainId,
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, registrar],
        })
        const needsApproval = allowance < price.total
        const calls = getGiftCalls(client, {
          ...setup,
          approveAmount: price.total,
        })

        if (await supportsAtomicBatch(params.chainId)) {
          // Approval and commit in a single wallet confirmation
          update({
            batched: true,
            phase: 'commit',
            txStatus: 'sign',
            approvalSkipped: !needsApproval,
          })
          const { id } = await sendCalls(config, {
            chainId: params.chainId,
            forceAtomic: true,
            calls: [...(needsApproval ? [calls.approve] : []), calls.commit],
          })
          draft.batchId = id
          saveDraft(params, draft)
          update({ txStatus: 'confirm' })
          await finishBatch(draft, id)
        } else {
          update({ batched: false })

          // 1. Approve the registrar to take payment
          update({ phase: 'approve', txStatus: undefined })
          if (needsApproval) {
            update({ txStatus: 'sign' })
            const hash = await writeContract(config, {
              chainId: params.chainId,
              address: token,
              abi: erc20Abi,
              functionName: 'approve',
              args: [registrar, price.total],
            })
            setHash('approve', hash)
            update({ txStatus: 'confirm' })
            const receipt = await waitForTransactionReceipt(config, {
              hash,
              chainId: params.chainId,
            })
            if (receipt.status !== 'success') {
              throw new Error('Approval failed')
            }
          } else {
            update({ approvalSkipped: true })
          }

          // 2. Commit to the registration (front-running protection)
          update({ phase: 'commit', txStatus: 'sign' })
          draft.commitHash = await commitName(wallet, registrationParams(draft))
          saveDraft(params, draft)
        }
      }

      setHash('commit', draft.commitHash!)
      update({ phase: 'commit', txStatus: 'confirm' })
      const receipt = await waitForTransactionReceipt(config, {
        hash: draft.commitHash!,
        chainId: params.chainId,
      })
      if (receipt.status !== 'success') {
        draft.commitHash = undefined
        saveDraft(params, draft)
        throw new Error('Commit transaction failed')
      }

      // 3. Wait for the commitment to mature, with enough allowance to pay
      update({ phase: 'wait', txStatus: undefined })
      await topUpAllowance()
      await waitUntilReady(draft)
    } catch (err) {
      update({ error: getErrorMessage(err) })
    } finally {
      running.current = false
    }
  }, [
    finishBatch,
    getClients,
    getDraft,
    params,
    registrationParams,
    setHash,
    topUpAllowance,
    update,
    waitUntilReady,
  ])

  /** 4. Reveal the commitment and pay for the name. */
  const register = useCallback(async () => {
    if (!params || running.current) return
    running.current = true
    update({ phase: 'register', txStatus: 'sign', error: undefined })

    try {
      const { wallet } = await getClients()
      const draft = getDraft()
      await topUpAllowance()
      update({ txStatus: 'sign' })
      const hash = await registerName(wallet, {
        ...registrationParams(draft),
        paymentToken: getPaymentTokenAddress(wallet.chain, params.token),
      })
      setHash('register', hash)
      update({ txStatus: 'confirm' })
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: params.chainId,
      })
      if (receipt.status !== 'success') {
        throw new Error('Registration transaction failed')
      }
      saveDraft(params, undefined)
      update({ phase: 'done', txStatus: undefined })
    } catch (err) {
      update({ error: getErrorMessage(err) })
    } finally {
      running.current = false
    }
  }, [
    getClients,
    getDraft,
    params,
    registrationParams,
    setHash,
    topUpAllowance,
    update,
  ])

  // Resume a gift that was committed before the page was closed
  useEffect(() => {
    if (!params) return
    const draft = loadDraft(params)
    setState({
      phase: draft?.commitHash ? 'wait' : 'idle',
      batched: !!draft?.batchId || undefined,
      hashes: draft?.commitHash ? { commit: draft.commitHash } : {},
    })
  }, [params])

  const retry = useCallback(() => {
    if (state.phase === 'register' || (state.phase === 'wait' && state.ready)) {
      return register()
    }
    return start()
  }, [register, start, state.phase, state.ready])

  return { state, start, register, retry }
}
