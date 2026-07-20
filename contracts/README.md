# Solidity contracts

## Core

| Path | Role |
|---|---|
| `src/interfaces/IAgentMemoryState.sol` | Normative v1 interface and events |
| `src/interfaces/IERC1271.sol` | Contract-wallet signature interface |
| `src/reference/AgentMemoryStateRegistry.sol` | Space authorization and linear state machine |
| `src/reference/PrivateCommitment.sol` | Internal-only conformance helpers for v1 commitments |
| `src/ECDSA.sol` | Dependency-light canonical ECDSA recovery |

The Registry derives Space IDs from initial controller and salt, validates every
prior root and sequence, supports EOA/EIP-1271 authorizers, and computes state
roots on-chain. Raw memory and raw locators never enter the core interface.
The commitment helper must not be wrapped by a public transaction function that
would place its private inputs in calldata.

## Extensions

`src/extensions/DeletionAttestation.sol` stores one scoped evidence commitment.
It is intentionally named an attestation and does not claim universal erasure.

## Experimental

`src/experimental/MemoryMarket.sol` is not part of the ERC. Listings bind the
current controller and state root so controller rotation or memory evolution
invalidates a stale sale.

## Verification

```bash
forge fmt --check
forge test
forge coverage
```

The suite includes unit tests, EIP-1271 tests, attack regressions, the shared
Golden Vector, and a state-machine invariant campaign.
