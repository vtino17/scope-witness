import type { ClaimManifest, IntentContract } from "./types.js";

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text);

export function assertContract(value: unknown): asserts value is IntentContract {
  if (!object(value) || value.schemaVersion !== "1.0" || !text(value.id) || !text(value.summary)) {
    throw new Error("Invalid intent contract header.");
  }
  if (!Array.isArray(value.outcomes) || value.outcomes.length === 0 || !object(value.rules)) {
    throw new Error("Intent contract requires outcomes and rules.");
  }
  const ids: string[] = [];
  for (const outcome of value.outcomes) {
    if (!object(outcome) || !text(outcome.id) || !text(outcome.statement) || !strings(outcome.pathPatterns) || !strings(outcome.requiredDiffTokens) || !Array.isArray(outcome.allowedChangeKinds)) {
      throw new Error("Invalid intent outcome.");
    }
    ids.push(outcome.id);
  }
  if (new Set(ids).size !== ids.length) throw new Error("Outcome IDs must be unique.");
  const rules = value.rules;
  for (const field of ["allowedPaths", "forbiddenPaths", "sourcePatterns", "testPatterns", "dependencyManifestPatterns", "workflowPatterns"] as const) {
    if (!strings(rules[field])) throw new Error(`Invalid rules.${field}.`);
  }
  for (const field of ["maxFiles", "maxChangedLines"] as const) {
    if (!Number.isInteger(rules[field]) || (rules[field] as number) < 1) throw new Error(`Invalid rules.${field}.`);
  }
  for (const field of ["requireTestsForSourceChanges", "allowDependencyChanges", "allowWorkflowChanges", "disallowCatchAllClaims"] as const) {
    if (typeof rules[field] !== "boolean") throw new Error(`Invalid rules.${field}.`);
  }
  if (!Array.isArray(rules.protectedPaths) || !rules.protectedPaths.every((entry) => object(entry) && text(entry.pattern) && text(entry.approvalId) && text(entry.reason))) {
    throw new Error("Invalid protected paths.");
  }
  if (!strings(value.approvals)) throw new Error("Approvals must be an array of strings.");
}

export function assertClaims(value: unknown): asserts value is ClaimManifest {
  if (!object(value) || value.schemaVersion !== "1.0" || !text(value.contractId) || !Array.isArray(value.claims)) {
    throw new Error("Invalid claim manifest.");
  }
  const ids: string[] = [];
  for (const claim of value.claims) {
    if (!object(claim) || !text(claim.id) || !text(claim.pathPattern) || !strings(claim.outcomeIds) || claim.outcomeIds.length === 0 || !text(claim.reason)) {
      throw new Error("Invalid change claim.");
    }
    ids.push(claim.id);
  }
  if (new Set(ids).size !== ids.length) throw new Error("Claim IDs must be unique.");
}
