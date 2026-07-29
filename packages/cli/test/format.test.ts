import { describe, expect, it } from "vitest";
import {
  alignedPatch,
  auditPatch,
  diffContracts,
  parseUnifiedDiff,
  sampleClaims,
  sampleContract,
  weakenedContract,
} from "@scopewitness/core";
import { formatAudit, formatDiff, formatInventory } from "../src/format.js";

describe("CLI formatting", () => {
  it("renders inventory", async () => {
    expect(formatInventory(await parseUnifiedDiff(alignedPatch))).toContain("2 files");
  });
  it("renders aligned audit", async () => {
    const audit = await auditPatch({ contract: sampleContract, claims: sampleClaims, patch: alignedPatch });
    expect(formatAudit(audit)).toContain("Status: ALIGNED");
  });
  it("renders weakened contracts", () => {
    expect(formatDiff(diffContracts(sampleContract, weakenedContract()))).toContain("Weakened controls");
  });
});
