# Release Process

Releases are implementation artifacts for community testing. They do not make
the draft an accepted ERC and do not imply that contracts are production ready.

## Versioning

- `1.0.0-alpha.x`: protocol details may still change after community review.
- `1.0.0-beta.x`: v1 encoding is frozen and at least one external implementation
  has passed the golden vectors.
- `1.0.0-rc.x`: editor feedback is incorporated, testnet deployments are public,
  and an external security review has no unresolved critical findings.
- `1.0.0`: the team declares the implementation stable. ERC status remains the
  status shown in the official ERC repository.

## Candidate checklist

1. Freeze the intended commit and update `CHANGELOG.md`.
2. Run `pnpm install --frozen-lockfile` in a fresh checkout.
3. Run `pnpm release:check` and confirm zero dependency advisories.
4. Verify the Solidity and both TypeScript implementations against the same
   `test-vectors/v1.json`.
5. Review storage layout, ABI changes, threat model, and migration notes.
6. Create a signed `v*` tag. The release workflow builds package tarballs,
   contract sources, and SHA-256 checksums without publishing automatically.
7. Attach audit and testnet deployment references before labeling an artifact
   production ready.

Package publication and contract deployment require a separate human approval.
Never deploy by reusing development keys or unrevealed commitment salts.
