import { hashValue } from "./canonical.js";
import { matchesAny, matchesGlob } from "./glob.js";
import { parseUnifiedDiff } from "./parser.js";
import type { ScopeAudit, ScopeIssue } from "./types.js";
import { assertClaims, assertContract } from "./validation.js";

const issue = (
  code: string,
  severity: ScopeIssue["severity"],
  message: string,
  target?: Pick<ScopeIssue, "path" | "hunkId" | "outcomeId">
): ScopeIssue => ({ code, severity, message, ...target });

export async function auditPatch(input: {
  contract: unknown;
  claims: unknown;
  patch: string;
  auditedAt?: Date;
}): Promise<ScopeAudit> {
  assertContract(input.contract);
  assertClaims(input.claims);
  const contract = input.contract;
  const claims = input.claims;
  if (claims.contractId !== contract.id) throw new Error("Claim manifest belongs to another contract.");
  const inventory = await parseUnifiedDiff(input.patch);
  const outcomes = new Map(contract.outcomes.map((entry) => [entry.id, entry]));
  const globalIssues: ScopeIssue[] = [];
  if (inventory.totalFiles > contract.rules.maxFiles) globalIssues.push(issue("file-budget-exceeded", "blocked", `${inventory.totalFiles} files exceed the limit of ${contract.rules.maxFiles}.`));
  if (inventory.changedLines > contract.rules.maxChangedLines) globalIssues.push(issue("line-budget-exceeded", "blocked", `${inventory.changedLines} changed lines exceed the limit of ${contract.rules.maxChangedLines}.`));
  const changedPaths = inventory.files.map((entry) => entry.path);
  const sourceChanged = changedPaths.some((path) => matchesAny(path, contract.rules.sourcePatterns));
  const testsChanged = changedPaths.some((path) => matchesAny(path, contract.rules.testPatterns));
  if (sourceChanged && contract.rules.requireTestsForSourceChanges && !testsChanged) globalIssues.push(issue("missing-test-change", "blocked", "Source files changed without a matching test-file change."));
  const patchText = inventory.files.flatMap((file) => file.hunks.map((hunk) => hunk.content)).join("\n");
  const fileIssues = inventory.files.flatMap((file) => {
    const issues: ScopeIssue[] = [];
    if (!matchesAny(file.path, contract.rules.allowedPaths)) issues.push(issue("path-outside-scope", "blocked", "Changed path is outside the allowed scope.", { path: file.path }));
    if (matchesAny(file.path, contract.rules.forbiddenPaths)) issues.push(issue("forbidden-path", "blocked", "Changed path is explicitly forbidden.", { path: file.path }));
    if (file.binary) issues.push(issue("binary-change", "blocked", "Binary changes cannot be attributed at hunk level.", { path: file.path }));
    if (matchesAny(file.path, contract.rules.dependencyManifestPatterns) && !contract.rules.allowDependencyChanges) issues.push(issue("dependency-change-not-approved", "blocked", "Dependency manifest changes are not approved.", { path: file.path }));
    if (matchesAny(file.path, contract.rules.workflowPatterns) && !contract.rules.allowWorkflowChanges) issues.push(issue("workflow-change-not-approved", "blocked", "Workflow changes are not approved.", { path: file.path }));
    for (const protectedPath of contract.rules.protectedPaths) {
      if (matchesGlob(file.path, protectedPath.pattern) && !contract.approvals.includes(protectedPath.approvalId)) {
        issues.push(issue("protected-path-without-approval", "blocked", `${protectedPath.reason} Requires approval "${protectedPath.approvalId}".`, { path: file.path }));
      }
    }
    return issues;
  });
  const hunkAudits = inventory.files.flatMap((file) =>
    file.hunks.map((hunk) => {
      const matchingClaims = claims.claims.filter((claim) => matchesGlob(file.path, claim.pathPattern));
      const issues: ScopeIssue[] = [];
      if (contract.rules.disallowCatchAllClaims) {
        for (const claim of matchingClaims.filter((entry) => ["**", "**/*", "*"].includes(entry.pathPattern))) {
          issues.push(issue("catch-all-claim", "blocked", `Claim "${claim.id}" is too broad to establish accountability.`, { path: file.path, hunkId: hunk.id }));
        }
      }
      const validOutcomeIds = new Set<string>();
      for (const claim of matchingClaims) {
        for (const outcomeId of claim.outcomeIds) {
          const outcome = outcomes.get(outcomeId);
          if (!outcome) {
            issues.push(issue("unknown-outcome", "blocked", `Claim "${claim.id}" references unknown outcome "${outcomeId}".`, { path: file.path, hunkId: hunk.id }));
          } else if (!matchesAny(file.path, outcome.pathPatterns)) {
            issues.push(issue("outcome-path-mismatch", "blocked", `Path does not belong to outcome "${outcomeId}".`, { path: file.path, hunkId: hunk.id, outcomeId }));
          } else if (!outcome.allowedChangeKinds.includes(file.kind)) {
            issues.push(issue("change-kind-not-allowed", "blocked", `${file.kind} changes are not allowed for outcome "${outcomeId}".`, { path: file.path, hunkId: hunk.id, outcomeId }));
          } else {
            validOutcomeIds.add(outcomeId);
          }
        }
      }
      if (matchingClaims.length === 0 || validOutcomeIds.size === 0) issues.push(issue("orphan-hunk", "blocked", "Hunk has no valid claim to a requested outcome.", { path: file.path, hunkId: hunk.id }));
      return {
        hunkId: hunk.id,
        path: file.path,
        covered: issues.length === 0,
        claimIds: matchingClaims.map((entry) => entry.id),
        outcomeIds: [...validOutcomeIds].sort(),
        issues,
      };
    })
  );
  const outcomeAudits = contract.outcomes.map((outcome) => {
    const hunkIds = hunkAudits.filter((hunk) => hunk.covered && hunk.outcomeIds.includes(outcome.id)).map((hunk) => hunk.hunkId);
    const missingTokens = outcome.requiredDiffTokens.filter((token) => !patchText.includes(token));
    const issues: ScopeIssue[] = [];
    if (hunkIds.length === 0) issues.push(issue("outcome-unimplemented", "blocked", "No covered hunk implements this requested outcome.", { outcomeId: outcome.id }));
    if (missingTokens.length > 0) issues.push(issue("required-diff-token-missing", "blocked", `Missing required diff tokens: ${missingTokens.join(", ")}.`, { outcomeId: outcome.id }));
    return { outcomeId: outcome.id, satisfied: issues.length === 0, hunkIds, missingTokens, issues };
  });
  const allIssues = [...globalIssues, ...fileIssues, ...hunkAudits.flatMap((entry) => entry.issues), ...outcomeAudits.flatMap((entry) => entry.issues)];
  const blocked = allIssues.filter((entry) => entry.severity === "blocked").length;
  const warnings = allIssues.length - blocked;
  const coveredHunks = hunkAudits.filter((entry) => entry.covered).length;
  const base = {
    contractId: contract.id,
    status: (blocked > 0 ? "blocked" : warnings > 0 ? "warning" : "aligned") as ScopeAudit["status"],
    score: Math.max(0, 100 - blocked * 12 - warnings * 4),
    files: inventory.totalFiles,
    changedLines: inventory.changedLines,
    coveredHunks,
    orphanHunks: hunkAudits.length - coveredHunks,
    hunks: hunkAudits,
    outcomes: outcomeAudits,
    issues: allIssues,
    patchHash: inventory.patchHash,
    auditedAt: (input.auditedAt ?? new Date()).toISOString(),
  };
  return { ...base, auditHash: await hashValue(base) };
}
