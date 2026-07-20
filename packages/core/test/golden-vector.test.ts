import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_DELTA_TYPEHASH,
  MEMORY_SPACE_TYPEHASH,
  MEMORY_STATE_TYPEHASH,
  computeDomainSeparator,
  computeLocatorCommitment,
  computeNextStateRoot,
  computePrivateCommitment,
  computeProvenanceCommitment,
  computeSigningDigest,
  computeSpaceAuthorizationId,
  computeSpaceRegistrationId,
  computeTransitionId,
  deriveSpaceId,
  type ExperienceDelta,
} from "../src/index.js";

const vector = JSON.parse(
  readFileSync(new URL("../../../test-vectors/v1.json", import.meta.url), "utf8"),
);
const delta: ExperienceDelta = { ...vector.delta, sequence: BigInt(vector.delta.sequence) };

describe("v1 golden vector", () => {
  it("matches commitments, transition id, and state root", () => {
    const encoder = new TextEncoder();
    expect(
      computePrivateCommitment(
        encoder.encode(vector.commitment.payload),
        vector.commitment.deltaSalt,
        vector.commitment.profileId,
      ),
    ).toBe(vector.commitment.deltaCommitment);
    expect(
      computeProvenanceCommitment(
        encoder.encode(vector.commitment.provenance),
        vector.commitment.provenanceSalt,
      ),
    ).toBe(vector.commitment.provenanceCommitment);
    expect(
      computeLocatorCommitment(vector.commitment.locator, vector.commitment.locatorSalt),
    ).toBe(vector.commitment.locatorCommitment);
    expect(EXPERIENCE_DELTA_TYPEHASH).toBe(vector.expected.experienceDeltaTypehash);
    expect(MEMORY_STATE_TYPEHASH).toBe(vector.expected.memoryStateTypehash);
    expect(MEMORY_SPACE_TYPEHASH).toBe(vector.expected.memorySpaceTypehash);
    expect(computeTransitionId(delta)).toBe(vector.expected.transitionId);
    expect(computeNextStateRoot(delta.prevStateRoot, vector.expected.transitionId)).toBe(
      vector.expected.nextStateRoot,
    );
  });

  it("matches EIP-712 and Space authorization values", () => {
    const eip712 = vector.eip712;
    expect(computeDomainSeparator(eip712.chainId, eip712.verifyingContract)).toBe(
      eip712.domainSeparator,
    );
    expect(
      computeSigningDigest(
        vector.expected.transitionId,
        eip712.chainId,
        eip712.verifyingContract,
      ),
    ).toBe(eip712.signingDigest);
    const authorization = vector.spaceAuthorization;
    expect(deriveSpaceId(authorization.controller, authorization.spaceSalt)).toBe(
      delta.spaceId,
    );
    expect(
      computeSpaceRegistrationId(
        delta.spaceId,
        authorization.controller,
        authorization.authorizer,
      ),
    ).toBe(authorization.registrationId);
    expect(
      computeSpaceAuthorizationId(
        delta.spaceId,
        authorization.controller,
        authorization.authorizer,
        authorization.updateNonce,
      ),
    ).toBe(authorization.authorizationId);
  });
});
