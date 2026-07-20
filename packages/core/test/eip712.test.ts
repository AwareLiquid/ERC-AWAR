import { describe, expect, it } from "vitest";
import {
  computeDomainSeparator,
  deriveSpaceId,
  computeSigningDigest,
  computeSpaceAuthorizationId,
  computeSpaceRegistrationId,
} from "../src/index.js";

const SPACE = "0x" + "11".repeat(32);
const CONTROLLER = "0x" + "22".repeat(20);
const AUTHORIZER = "0x" + "33".repeat(20);
const REGISTRY = "0x" + "44".repeat(20);

describe("EIP-712 authorization", () => {
  it("binds the domain to chain and registry", () => {
    const a = computeDomainSeparator(1n, REGISTRY);
    expect(a).not.toBe(computeDomainSeparator(10n, REGISTRY));
    expect(a).not.toBe(computeDomainSeparator(1n, "0x" + "55".repeat(20)));
  });

  it("hashes space registration and configuration updates", () => {
    const registration = computeSpaceRegistrationId(SPACE, CONTROLLER, AUTHORIZER);
    const update = computeSpaceAuthorizationId(SPACE, CONTROLLER, AUTHORIZER, 1n);
    expect(registration).toMatch(/^0x[0-9a-f]{64}$/);
    expect(update).not.toBe(registration);
    expect(computeSigningDigest(registration, 1n, REGISTRY)).not.toBe(registration);
  });

  it("derives namespaces from the initial controller and a salt", () => {
    const salt = "0x" + "aa".repeat(32);
    expect(deriveSpaceId(CONTROLLER, salt)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(deriveSpaceId(CONTROLLER, salt)).not.toBe(
      deriveSpaceId(AUTHORIZER, salt),
    );
  });
});
