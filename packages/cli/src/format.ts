import type {
  ContractDiff,
  DiffInventory,
  ScopeAudit,
} from "@scopewitness/core";

export function formatInventory(inventory: DiffInventory): string {
  const lines = [`Patch inventory · ${inventory.totalFiles} files · +${inventory.additions} -${inventory.deletions}`, ""];
  for (const file of inventory.files) {
    lines.push(`${file.kind.toUpperCase()} ${file.path} · +${file.additions} -${file.deletions}`);
    for (const hunk of file.hunks) lines.push(`  ${hunk.id} ${hunk.header}`);
  }
  return lines.join("\n");
}

export function formatAudit(audit: ScopeAudit): string {
  const lines = [
    `ScopeWitness · ${audit.contractId}`,
    `Status: ${audit.status.toUpperCase()} · score ${audit.score}/100 · ${audit.coveredHunks} covered · ${audit.orphanHunks} orphan`,
    "",
  ];
  for (const outcome of audit.outcomes) lines.push(`${outcome.satisfied ? "✓" : "×"} ${outcome.outcomeId} · ${outcome.hunkIds.length} hunks`);
  if (audit.issues.length > 0) {
    lines.push("", "Findings");
    for (const entry of audit.issues) lines.push(`  ${entry.severity.toUpperCase()} ${entry.code}${entry.path ? ` [${entry.path}]` : ""}: ${entry.message}`);
  }
  return lines.join("\n");
}

export function formatDiff(diff: ContractDiff): string {
  return [
    `Contract diff: ${diff.from} → ${diff.to}`,
    `Weakened controls: ${diff.weakenedControls.length}`,
    ...diff.weakenedControls.map((entry) => `- ${entry}`),
  ].join("\n");
}
