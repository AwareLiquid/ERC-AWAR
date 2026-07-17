# @erc-awar/awareness-adapter

Product adapter from Awareness cards and embeddings to Agent Memory State v1.

The adapter:

- maps Awareness card kinds to Awareness-owned profiles;
- includes resource ID and operation inside the private payload;
- creates salted payload, provenance, and locator commitments;
- returns the public Delta separately from its private witness; and
- advances the reference state machine.

Profile names such as `TEXT`, `POLICY`, and `EMBEDDING` are not protocol enums.
They may evolve without changing the ERC core.

```ts
import { AwarenessAdapter } from "@erc-awar/awareness-adapter";

const adapter = new AwarenessAdapter(spaceId);
const transition = adapter.ingest({
  id: "preference:theme",
  type: "memory",
  content: "User prefers dark mode",
});

transition.delta;      // safe public claim
transition.witness;    // private locator and salts; do not send as calldata
```
