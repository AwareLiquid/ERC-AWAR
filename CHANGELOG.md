# Changelog

All notable implementation and protocol changes are recorded here.

## Unreleased

### Added

- Whitepaper as a narrative companion to the ERC, following the Ethereum
  whitepaper structure (state transition systems → memory as state → protocol →
  applications → concerns → conclusion) and closing with an Open Questions
  section for the Ethereum Magicians discussion:
  `docs/whitepaper.md` (English), `docs/whitepaper.zh.md` (Chinese), plus
  `docs/whitepaper.pdf` and single-file `docs/whitepaper.html` renderings.

## 1.0.0-alpha.1 - 2026-07-14

### Added

- Canonical seven-field `ExperienceDelta v1` and EIP-712 Transition ID.
- Linear `prevStateRoot -> Delta -> nextStateRoot` state machine.
- Controller-derived Space IDs and controller/authorizer rotation.
- EOA and EIP-1271 authorization with relayer-safe locator commitments.
- Domain-separated salted private commitments and private witnesses.
- Core, Extension, Experimental, Adapter, and Implementation boundaries.
- Shared Solidity/TypeScript golden vectors and invariant tests.
- Awareness adapter and a dependency-isolated second TypeScript implementation.
- Reproducible pnpm workspace, CI, release artifacts, and rewritten ERC draft.

### Removed

- JCS-based alternate Delta IDs, raw URI calldata, speculative `83xx` naming,
  product taxonomies in Core, and unsigned Space takeover paths.
