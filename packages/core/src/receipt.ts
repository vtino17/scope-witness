import { auditPatch } from "./audit.js";
import { canonicalJson, hashValue, sha256 } from "./canonical.js";
import type {
  ClaimManifest,
  IntentContract,
  ReceiptVerification,
  ScopeAudit,
  ScopeReceipt,
} from "./types.js";
import { assertClaims, assertContract } from "./validation.js";

export async function compileScopeReceipt(input: {
  contract: unknown;
  claims: unknown;
  patch: string;
  audit: ScopeAudit;
  issuedAt?: Date;
}): Promise<ScopeReceipt> {
  assertContract(input.contract);
  assertClaims(input.claims);
  const expected = await auditPatch({ contract: input.contract, claims: input.claims, patch: input.patch, auditedAt: new Date(input.audit.auditedAt) });
  if (canonicalJson(expected) !== canonicalJson(input.audit)) throw new Error("Audit does not match a fresh evaluation.");
  if (input.audit.status === "blocked") throw new Error("Cannot certify a blocked patch.");
  const base = {
    receiptVersion: "1.0" as const,
    contractId: input.contract.id,
    contractHash: await hashValue(input.contract),
    claimsHash: await hashValue(input.claims),
    patchHash: input.audit.patchHash,
    auditHash: input.audit.auditHash,
    auditedAt: input.audit.auditedAt,
    issuedAt: (input.issuedAt ?? new Date()).toISOString(),
    coveredHunkIds: input.audit.hunks.filter((entry) => entry.covered).map((entry) => entry.hunkId),
    satisfiedOutcomeIds: input.audit.outcomes.filter((entry) => entry.satisfied).map((entry) => entry.outcomeId),
  };
  return { ...base, receiptHash: await sha256(canonicalJson(base)) };
}

export async function verifyScopeReceipt(input: {
  receipt: ScopeReceipt;
  contract?: unknown;
  claims?: unknown;
  patch?: string;
}): Promise<ReceiptVerification> {
  const receipt = input.receipt;
  const base: Omit<ScopeReceipt, "receiptHash"> = {
    receiptVersion: receipt.receiptVersion,
    contractId: receipt.contractId,
    contractHash: receipt.contractHash,
    claimsHash: receipt.claimsHash,
    patchHash: receipt.patchHash,
    auditHash: receipt.auditHash,
    auditedAt: receipt.auditedAt,
    issuedAt: receipt.issuedAt,
    coveredHunkIds: receipt.coveredHunkIds,
    satisfiedOutcomeIds: receipt.satisfiedOutcomeIds,
  };
  const checks = {
    receiptHash: await sha256(canonicalJson(base)) === receipt.receiptHash,
    contractHash: true,
    claimsHash: true,
    patchHash: true,
    auditHash: true,
  };
  if (input.contract !== undefined) {
    assertContract(input.contract);
    checks.contractHash = await hashValue(input.contract) === receipt.contractHash;
  }
  if (input.claims !== undefined) {
    assertClaims(input.claims);
    checks.claimsHash = await hashValue(input.claims) === receipt.claimsHash;
  }
  if (input.patch !== undefined) {
    checks.patchHash = (await sha256(input.patch.replace(/\r\n/g, "\n"))) === receipt.patchHash;
    if (input.contract !== undefined && input.claims !== undefined) {
      const audit = await auditPatch({ contract: input.contract, claims: input.claims, patch: input.patch, auditedAt: new Date(receipt.auditedAt) });
      checks.auditHash = audit.auditHash === receipt.auditHash;
    }
  }
  const errors = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => `${name} check failed`);
  return { valid: errors.length === 0, checks, errors };
}

export type { ClaimManifest, IntentContract };
