export { auditPatch } from "./audit.js";
export { canonicalJson, hashValue, sha256 } from "./canonical.js";
export { diffContracts } from "./diff.js";
export { matchesAny, matchesGlob } from "./glob.js";
export { parseUnifiedDiff } from "./parser.js";
export {
  alignedPatch,
  sampleClaims,
  sampleContract,
  scopeCreepPatch,
  weakenedContract,
} from "./sample.js";
export {
  compileScopeReceipt,
  verifyScopeReceipt,
} from "./receipt.js";
export { assertClaims, assertContract } from "./validation.js";
export type {
  ChangedFile,
  ChangeClaim,
  ChangeKind,
  ClaimManifest,
  ContractDiff,
  DiffHunk,
  DiffInventory,
  HunkAudit,
  IntentContract,
  IntentOutcome,
  OutcomeAudit,
  ProtectedPath,
  ReceiptVerification,
  ScopeAudit,
  ScopeIssue,
  ScopeReceipt,
  ScopeRules,
} from "./types.js";
