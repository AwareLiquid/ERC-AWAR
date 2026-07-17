# @erc-awar/core

Protocol-neutral TypeScript implementation of Agent Memory State v1.

It provides:

- the seven-field `ExperienceDelta` type;
- EIP-712 Transition ID and signing-domain functions;
- deterministic state-root transitions;
- Space ID, registration, and authorization-update hashes;
- salted payload, provenance, and locator commitments; and
- lossless JSON conversion for `uint64` sequence values.

```ts
import {
  ZERO32,
  computeNextStateRoot,
  computeTransitionId,
  type ExperienceDelta,
} from "@erc-awar/core";

const delta: ExperienceDelta = {
  spaceId,
  sequence: 1n,
  prevStateRoot: ZERO32,
  deltaCommitment,
  provenanceCommitment: ZERO32,
  profileId,
  locatorCommitment,
};

const transitionId = computeTransitionId(delta);
const nextStateRoot = computeNextStateRoot(delta.prevStateRoot, transitionId);
```

JCS is not used for `transitionId`. Payload canonicalization belongs to profiles;
the core hash always uses ABI encoding of fixed-width fields.
