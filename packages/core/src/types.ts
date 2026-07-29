export type ChangeKind = "added" | "modified" | "deleted" | "renamed";

export interface IntentOutcome {
  id: string;
  statement: string;
  pathPatterns: string[];
  requiredDiffTokens: string[];
  allowedChangeKinds: ChangeKind[];
}

export interface ProtectedPath {
  pattern: string;
  approvalId: string;
  reason: string;
}

export interface ScopeRules {
  allowedPaths: string[];
  forbiddenPaths: string[];
  maxFiles: number;
  maxChangedLines: number;
  sourcePatterns: string[];
  testPatterns: string[];
  requireTestsForSourceChanges: boolean;
  dependencyManifestPatterns: string[];
  workflowPatterns: string[];
  allowDependencyChanges: boolean;
  allowWorkflowChanges: boolean;
  protectedPaths: ProtectedPath[];
  disallowCatchAllClaims: boolean;
}

export interface IntentContract {
  schemaVersion: "1.0";
  id: string;
  summary: string;
  outcomes: IntentOutcome[];
  rules: ScopeRules;
  approvals: string[];
}

export interface ChangeClaim {
  id: string;
  pathPattern: string;
  outcomeIds: string[];
  reason: string;
}

export interface ClaimManifest {
  schemaVersion: "1.0";
  contractId: string;
  claims: ChangeClaim[];
}

export interface DiffHunk {
  id: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  additions: number;
  deletions: number;
  content: string;
}

export interface ChangedFile {
  path: string;
  oldPath: string;
  kind: ChangeKind;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: DiffHunk[];
}

export interface DiffInventory {
  files: ChangedFile[];
  totalFiles: number;
  additions: number;
  deletions: number;
  changedLines: number;
  patchHash: string;
}

export interface ScopeIssue {
  code: string;
  severity: "warning" | "blocked";
  message: string;
  path?: string;
  hunkId?: string;
  outcomeId?: string;
}

export interface HunkAudit {
  hunkId: string;
  path: string;
  covered: boolean;
  claimIds: string[];
  outcomeIds: string[];
  issues: ScopeIssue[];
}

export interface OutcomeAudit {
  outcomeId: string;
  satisfied: boolean;
  hunkIds: string[];
  missingTokens: string[];
  issues: ScopeIssue[];
}

export interface ScopeAudit {
  contractId: string;
  status: "aligned" | "warning" | "blocked";
  score: number;
  files: number;
  changedLines: number;
  coveredHunks: number;
  orphanHunks: number;
  hunks: HunkAudit[];
  outcomes: OutcomeAudit[];
  issues: ScopeIssue[];
  patchHash: string;
  auditedAt: string;
  auditHash: string;
}

export interface ScopeReceipt {
  receiptVersion: "1.0";
  contractId: string;
  contractHash: string;
  claimsHash: string;
  patchHash: string;
  auditHash: string;
  auditedAt: string;
  issuedAt: string;
  coveredHunkIds: string[];
  satisfiedOutcomeIds: string[];
  receiptHash: string;
}

export interface ReceiptVerification {
  valid: boolean;
  checks: Record<"receiptHash" | "contractHash" | "claimsHash" | "patchHash" | "auditHash", boolean>;
  errors: string[];
}

export interface ContractDiff {
  from: string;
  to: string;
  weakenedControls: string[];
}
