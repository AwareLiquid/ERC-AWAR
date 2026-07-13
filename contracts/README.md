# contracts/ — ERC-83xx on-chain registry & market (M3)

Foundry project. Append-only commitment log of Agent **Experience Deltas**
(SPEC §6) plus a reference licensing **memory market** (SPEC §10).

## Contracts

| File | Role |
| --- | --- |
| `src/IERC83xx.sol` | Registry interface: `ExperienceDelta` struct, `MemoryType` enum, events, `commitDelta` / `head` / `revoke` / `proveDeletion`. |
| `src/ERC83xxRegistry.sol` | Reference registry. EIP-712 identity binding (ERC-8004): the agent is **recovered** from the signature, so relayers can submit. Linear append-only chain; per-space `head`; compliance flow `revoke` → `proveDeletion` (SPEC §9). |
| `src/MemoryMarket.sol` | Time-bounded licensing of a memory space. Owner = agent of the current head delta. ERC-20 settlement with optional royalty split (SPEC §10). |
| `src/ECDSA.sol` | Inline, dependency-free ECDSA recovery (EIP-2 malleability guard). |

## Design notes

- **Only commitments on-chain.** Raw prompts / embeddings / latent state never
  hit calldata — `newContentCommitment` + `uri` point at the encrypted payload.
- **Replay safety (SPEC §14).** The EIP-712 domain pins `chainId` (anti
  cross-chain) and the signed struct pins `spaceId` + `previousDelta` (anti
  cross-space). `deltaId = hashStruct(ExperienceDelta)` is content-addressed.
- **`deltaId` is the EIP-712 struct hash**, computed on-chain via
  `hashDelta()`. (Off-chain `@erc-awar/spec` uses JCS/JSON canonicalization for
  its own id; the two serializations serve different layers and are not required
  to be byte-identical.)
- **Single-writer spaces.** The genesis signer becomes the space's recorded
  agent; every non-genesis delta must recover to that same agent, otherwise
  anyone observing the public head could hijack the space (and the market
  ownership derived from it). Delegation / rotation is a policy extension.
- **Authorization is intentionally minimal.** `revoke` / `proveDeletion` /
  market `list` are gated on the recorded agent. A production deployment routes
  these through ERC-8264 rights / ERC-8312 mandate modules.

## Build & test

forge-std is gitignored; install it once after cloning:

```bash
forge install foundry-rs/forge-std --no-git
forge build
forge test
```

26 tests cover genesis/chaining, signature recovery, append authorization
(space-hijack rejection), chain-link & timestamp guards, the
revoke→proveDeletion compliance ordering, and market
listing/purchase/royalty/expiry.
