import {
  addressWord,
  bytes32Word,
  concatBytes,
  keccak256,
  keccak256Utf8,
  uintWord,
} from "./hash.js";
import { asUint64 } from "./types.js";

export const EIP712_DOMAIN_TYPE =
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";
export const EIP712_DOMAIN_TYPEHASH = keccak256Utf8(EIP712_DOMAIN_TYPE);
export const EIP712_NAME = "AgentMemoryState";
export const EIP712_VERSION = "1";

export const SPACE_REGISTRATION_TYPE =
  "SpaceRegistration(bytes32 spaceId,address controller,address authorizer)";
export const SPACE_REGISTRATION_TYPEHASH = keccak256Utf8(SPACE_REGISTRATION_TYPE);

export const MEMORY_SPACE_TYPE =
  "MemorySpace(address initialController,bytes32 salt)";
export const MEMORY_SPACE_TYPEHASH = keccak256Utf8(MEMORY_SPACE_TYPE);

export const SPACE_AUTHORIZATION_TYPE =
  "SpaceAuthorization(bytes32 spaceId,address newController,address newAuthorizer,uint64 nonce)";
export const SPACE_AUTHORIZATION_TYPEHASH = keccak256Utf8(SPACE_AUTHORIZATION_TYPE);

export function computeDomainSeparator(
  chainId: bigint | number | string,
  verifyingContract: string,
): string {
  const id = BigInt(chainId);
  if (id < 0n) throw new Error("chainId must be non-negative");
  return keccak256(
    concatBytes(
      bytes32Word(EIP712_DOMAIN_TYPEHASH),
      bytes32Word(keccak256Utf8(EIP712_NAME)),
      bytes32Word(keccak256Utf8(EIP712_VERSION)),
      uintWord(id),
      addressWord(verifyingContract, "verifyingContract"),
    ),
  );
}

export function computeSigningDigest(
  structHash: string,
  chainId: bigint | number | string,
  verifyingContract: string,
): string {
  return keccak256(
    concatBytes(
      new Uint8Array([0x19, 0x01]),
      bytes32Word(computeDomainSeparator(chainId, verifyingContract)),
      bytes32Word(structHash, "structHash"),
    ),
  );
}

export function computeSpaceRegistrationId(
  spaceId: string,
  controller: string,
  authorizer: string,
): string {
  return keccak256(
    concatBytes(
      bytes32Word(SPACE_REGISTRATION_TYPEHASH),
      bytes32Word(spaceId, "spaceId"),
      addressWord(controller, "controller"),
      addressWord(authorizer, "authorizer"),
    ),
  );
}

/** Collision-resistant namespace derived from its initial controller and salt. */
export function deriveSpaceId(initialController: string, salt: string): string {
  return keccak256(
    concatBytes(
      bytes32Word(MEMORY_SPACE_TYPEHASH),
      addressWord(initialController, "initialController"),
      bytes32Word(salt, "salt"),
    ),
  );
}

export function computeSpaceAuthorizationId(
  spaceId: string,
  newController: string,
  newAuthorizer: string,
  nonce: bigint | number | string,
): string {
  return keccak256(
    concatBytes(
      bytes32Word(SPACE_AUTHORIZATION_TYPEHASH),
      bytes32Word(spaceId, "spaceId"),
      addressWord(newController, "newController"),
      addressWord(newAuthorizer, "newAuthorizer"),
      uintWord(asUint64(nonce, "nonce")),
    ),
  );
}
