# ADR-0005: Metadata Layers and Auditability

- Status: Proposed
- Date: 2026-07-23

## Context

Core commits only opaque values. A memory space is therefore tamper-evident — the
linear `sequence`, the `prevStateRoot` binding, and the folded accumulator make any
retroactive edit detectable — but it is not *auditable*. Three gaps follow.

**1. `profileId` sits in the worst position available.** It is the only semantic field
on chain. It is unsalted, and its vocabulary is published as eight names under a known
URI prefix, so an observer can precompute the preimages and label every transition by
memory kind. For adapter-originated cards the card-type to profile map is 6-to-3, so
the label is uniquely invertible: `POLICY` means the card was a `decision`. That is a
real disclosure, acknowledged in Security Considerations only as "metadata leakage".
Yet `profileId` is not indexed in `TransitionCommitted`, is not persisted in registry
storage (it exists only in logs, so storage-only readers such as `MemoryMarket` cannot
see it), and has no published vocabulary contract. It pays the full privacy cost and
buys none of the discoverability benefit.

**2. Nothing addresses disclosure or discoverability.** An auditor cannot learn what a
space is about, cannot tell a complete disclosure from a cherry-picked one, and has no
on-chain channel through which access is granted or acknowledged. `MemoryMarket`
compounds this: its `Listing` carries no descriptive field and no delivery mechanism,
so a buyer pays for a mapping entry without knowing what was bought or whether it was
delivered.

**3. Selective disclosure is unverifiable.** A controller can already hand an auditor a
witness and the auditor can check it against `deltaCommitment`. But the controller
chooses *which* witnesses to hand over. Per-item verification does not establish that
the disclosed set is the whole set for a stated range.

The objective is that an agent's trajectory be auditable and tamper-evident without
making memory contents public.

## Decision

Metadata is stratified into three layers with strictly separated visibility. A field
lives in exactly one layer.

**Layer 1 — Core (on chain, zero semantic metadata).** Unchanged. Core continues to
carry only `spaceId`, `sequence`, prior and next state roots, the three commitments,
`profileId`, and the authorizing address. No descriptive field is added to
`ExperienceDelta`, and the seven-field struct is not extended. Tamper-evidence is
already complete at this layer and needs nothing further.

`profileId` is reclassified, not changed: it is hereby documented as a **public,
non-confidential** field rather than treated as incidentally leaky. Applications that
require the memory kind to remain secret MUST allocate an opaque per-space profile
identifier instead of a shared vocabulary entry. This is a documentation and guidance
change; the wire format is untouched.

**Layer 2 — Disclosure (optional extensions, controller opt-in).** Two extensions,
both outside core, each publishing its own trust model:

- `SpaceDescriptor` — the controller MAY publish a public descriptor URI plus a content
  hash describing *what a space is*: domain, purpose, schema version, and the profile
  vocabulary needed to interpret its `profileId` values. It never describes what the
  space contains. Publishing is voluntary; a space that never publishes remains exactly
  as opaque as it is today.

- `AuditGrant` — the controller records that a named auditor is granted a specific
  `[fromSequence, toSequence]` range, and binds the **complete** witness set for that
  range to a single `witnessSetRoot`. The auditor, having received the witnesses out of
  band, recomputes the root and MAY acknowledge on chain that the disclosure verified.

  The root is a fold in the same shape the protocol already uses for state:

  ```text
  AUDIT_WITNESS_TYPE = "AuditWitness(bytes32 prevRoot,bytes32 transitionId,bytes32 witnessHash)"

  root_0 = 0
  root_i = keccak256(abi.encode(
      keccak256(bytes(AUDIT_WITNESS_TYPE)),
      root_{i-1}, transitionId_i, witnessHash_i
  ))
  ```

  where `witnessHash_i = keccak256(witnessBytes_i)` over the payload, salts, and locator
  disclosed for transition *i*, taken in ascending `sequence` order with no gaps. Because
  the root commits to the ordered set before disclosure occurs, withholding, reordering,
  or substituting any single witness changes the root. Completeness of a disclosure
  therefore becomes verifiable, not merely asserted.

**Layer 3 — Private witness (off chain).** Everything else. The full local metadata —
category, tags, title, summary, confidence, salience, growth stage, access counts, and
the payload itself — stays off chain, travels only as a private witness, and is
disclosed selectively under a Layer 2 grant.

**Additionally**, `DeletionAttestation.attest` MUST accept `bytes32 evidenceCommitment`
rather than `bytes calldata evidence`. Passing raw evidence as a public transaction
argument permanently publishes it in calldata, contradicting architecture invariant 9
and the stated rule against exposing raw private payloads through a public wrapper.

## Consequences

Core stays byte-for-byte unchanged, so existing implementations and the golden vectors
remain valid; conformance is unaffected. Auditability becomes an opt-in property that a
controller elects per space, and the cost of discoverability is paid only by spaces that
choose to be discovered — a space that publishes no descriptor and issues no grant is
exactly as private as before this ADR.

Completeness of a selective disclosure becomes cryptographically verifiable, which is
the property auditing actually requires and which per-item commitment checking cannot
provide. Acknowledgement makes the audit itself a matter of record, so a controller
cannot later claim an audit did not occur and an auditor cannot later claim to have
received a different set.

The trade-off is explicit and now named: `profileId` is public. We accept the leak in
exchange for the one usable discovery handle, rather than continuing to pay for it
without collecting. Applications needing kind-secrecy have a documented escape hatch
(per-space opaque profile identifiers).

`AuditGrant` proves that a disclosed set matches what was committed. It does not prove
that the committed witnesses are truthful, that the underlying data is still available,
or that the auditor is competent or honest. Those remain outside the protocol, as does
enforcement of `hasLicense` in `MemoryMarket`, which this ADR does not attempt to fix.
