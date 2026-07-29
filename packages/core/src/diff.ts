import type { ContractDiff, IntentContract } from "./types.js";
import { assertContract } from "./validation.js";

export function diffContracts(fromValue: unknown, toValue: unknown): ContractDiff {
  assertContract(fromValue);
  assertContract(toValue);
  const from = fromValue;
  const to = toValue;
  const weakenedControls: string[] = [];
  if (to.rules.maxFiles > from.rules.maxFiles) weakenedControls.push(`File budget increased from ${from.rules.maxFiles} to ${to.rules.maxFiles}.`);
  if (to.rules.maxChangedLines > from.rules.maxChangedLines) weakenedControls.push(`Line budget increased from ${from.rules.maxChangedLines} to ${to.rules.maxChangedLines}.`);
  for (const pattern of to.rules.allowedPaths.filter((entry) => !from.rules.allowedPaths.includes(entry))) weakenedControls.push(`Allowed path "${pattern}" was added.`);
  for (const pattern of from.rules.forbiddenPaths.filter((entry) => !to.rules.forbiddenPaths.includes(entry))) weakenedControls.push(`Forbidden path "${pattern}" was removed.`);
  if (from.rules.requireTestsForSourceChanges && !to.rules.requireTestsForSourceChanges) weakenedControls.push("Source changes no longer require test changes.");
  if (!from.rules.allowDependencyChanges && to.rules.allowDependencyChanges) weakenedControls.push("Dependency changes became allowed.");
  if (!from.rules.allowWorkflowChanges && to.rules.allowWorkflowChanges) weakenedControls.push("Workflow changes became allowed.");
  if (from.rules.disallowCatchAllClaims && !to.rules.disallowCatchAllClaims) weakenedControls.push("Catch-all change claims became allowed.");
  for (const item of from.rules.protectedPaths.filter((entry) => !to.rules.protectedPaths.some((next) => next.pattern === entry.pattern && next.approvalId === entry.approvalId))) weakenedControls.push(`Protected path "${item.pattern}" lost its approval rule.`);
  const nextOutcomes = new Map(to.outcomes.map((entry) => [entry.id, entry]));
  for (const outcome of from.outcomes) {
    const next = nextOutcomes.get(outcome.id);
    if (!next) weakenedControls.push(`Outcome "${outcome.id}" was removed.`);
    else {
      for (const token of outcome.requiredDiffTokens.filter((entry) => !next.requiredDiffTokens.includes(entry))) weakenedControls.push(`Outcome "${outcome.id}" dropped required token "${token}".`);
      for (const kind of next.allowedChangeKinds.filter((entry) => !outcome.allowedChangeKinds.includes(entry))) weakenedControls.push(`Outcome "${outcome.id}" now allows ${kind} changes.`);
    }
  }
  return { from: from.id, to: to.id, weakenedControls };
}

export type { IntentContract };
