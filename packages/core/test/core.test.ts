import { describe, expect, it } from "vitest";
import {
  alignedPatch,
  auditPatch,
  compileScopeReceipt,
  diffContracts,
  matchesGlob,
  parseUnifiedDiff,
  sampleClaims,
  sampleContract,
  scopeCreepPatch,
  verifyScopeReceipt,
  weakenedContract,
} from "../src/index.js";

const at = new Date("2026-07-29T06:30:00.000Z");

describe("glob matching", () => {
  it("matches recursive and single-segment patterns", () => {
    expect(matchesGlob("test/unit/session.test.ts", "test/**/*.test.ts")).toBe(true);
    expect(matchesGlob("src/session.ts", "src/*.ts")).toBe(true);
    expect(matchesGlob("src/deep/session.ts", "src/*.ts")).toBe(false);
  });
});

describe("unified diff inventory", () => {
  it("parses files, hunks, and line counts", async () => {
    const inventory = await parseUnifiedDiff(alignedPatch);
    expect(inventory.totalFiles).toBe(2);
    expect(inventory.files[0]!.hunks[0]!.id).toHaveLength(16);
    expect(inventory.additions).toBeGreaterThan(0);
    expect(inventory.deletions).toBe(1);
  });

  it("detects added, deleted, renamed, and binary files", async () => {
    const patch = `diff --git a/a.txt b/a.txt\nnew file mode 100644\n@@ -0,0 +1 @@\n+new\ndiff --git a/b.txt b/b.txt\ndeleted file mode 100644\n@@ -1 +0,0 @@\n-old\ndiff --git a/old.txt b/new.txt\nsimilarity index 100%\nrename from old.txt\nrename to new.txt\ndiff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ\n`;
    const inventory = await parseUnifiedDiff(patch);
    expect(inventory.files.map((entry) => entry.kind)).toEqual(["added", "deleted", "renamed", "modified"]);
    expect(inventory.files[3]!.binary).toBe(true);
  });
});

describe("scope auditing", () => {
  it("aligns every hunk to a requested outcome", async () => {
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, auditedAt: at });
    expect(audit.status).toBe("aligned");
    expect(audit.score).toBe(100);
    expect(audit.orphanHunks).toBe(0);
    expect(audit.outcomes.every((entry) => entry.satisfied)).toBe(true);
  });

  it.each([
    "dependency-change-not-approved",
    "workflow-change-not-approved",
    "protected-path-without-approval",
    "orphan-hunk",
  ])("detects %s in a scope-creep patch", async (code) => {
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: scopeCreepPatch, auditedAt: at });
    expect(audit.issues.some((entry) => entry.code === code)).toBe(true);
  });

  it("requires tests for source changes", async () => {
    const onlySource = alignedPatch.split("diff --git a/test/")[0]!;
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: onlySource, auditedAt: at });
    expect(audit.issues.some((entry) => entry.code === "missing-test-change")).toBe(true);
  });

  it("rejects catch-all claims", async () => {
    const claims = structuredClone(sampleClaims);
    claims.claims = [{ id: "everything", pathPattern: "**/*", outcomeIds: ["bounded-refresh"], reason: "all changes" }];
    const audit = await auditPatch({ contract: sampleContract, claims, patch: alignedPatch, auditedAt: at });
    expect(audit.issues.some((entry) => entry.code === "catch-all-claim")).toBe(true);
  });

  it("rejects outcome path mismatches and unknown outcomes", async () => {
    const claims = structuredClone(sampleClaims);
    claims.claims[0]!.outcomeIds = ["timeout-regression-test", "missing"];
    const audit = await auditPatch({ contract: sampleContract, claims, patch: alignedPatch, auditedAt: at });
    expect(audit.issues.some((entry) => entry.code === "outcome-path-mismatch")).toBe(true);
    expect(audit.issues.some((entry) => entry.code === "unknown-outcome")).toBe(true);
  });

  it("detects missing required diff tokens", async () => {
    const patch = alignedPatch.replace("AbortSignal.timeout", "AbortController");
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch, auditedAt: at });
    expect(audit.issues.some((entry) => entry.code === "required-diff-token-missing")).toBe(true);
  });

  it("enforces file and line budgets", async () => {
    const contract = structuredClone(sampleContract);
    contract.rules.maxFiles = 1;
    contract.rules.maxChangedLines = 1;
    const codes = (await auditPatch({ contract, claims: sampleClaims, patch: alignedPatch, auditedAt: at })).issues.map((entry) => entry.code);
    expect(codes).toContain("file-budget-exceeded");
    expect(codes).toContain("line-budget-exceeded");
  });
});

describe("scope receipts", () => {
  it("compiles and verifies an aligned patch receipt", async () => {
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, auditedAt: at });
    const receipt = await compileScopeReceipt({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, audit, issuedAt: at });
    expect((await verifyScopeReceipt({ receipt, contract: sampleContract, claims: sampleClaims, patch: alignedPatch })).valid).toBe(true);
  });

  it("detects receipt and patch tampering", async () => {
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, auditedAt: at });
    const receipt = await compileScopeReceipt({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, audit, issuedAt: at });
    expect((await verifyScopeReceipt({ receipt, contract: sampleContract, claims: sampleClaims, patch: `${alignedPatch}\n# tamper` })).valid).toBe(false);
  });

  it("refuses blocked patches and forged audits", async () => {
    const blocked = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: scopeCreepPatch, auditedAt: at });
    await expect(compileScopeReceipt({ contract: sampleContract, claims: sampleClaims, patch: scopeCreepPatch, audit: blocked })).rejects.toThrow("blocked");
    const aligned = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, auditedAt: at });
    aligned.score = 1;
    await expect(compileScopeReceipt({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch, audit: aligned })).rejects.toThrow("fresh evaluation");
  });
});

describe("contract regression", () => {
  it("reports every weakened control", () => {
    expect(diffContracts(sampleContract, weakenedContract()).weakenedControls.length).toBeGreaterThanOrEqual(10);
  });
});
