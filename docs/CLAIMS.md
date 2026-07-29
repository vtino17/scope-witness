# Claim manifest reference

A claim manifest is the patch author's accountability statement. It maps
changed paths to one or more outcomes and explains why the change exists.

```json
{
  "schemaVersion": "1.0",
  "contractId": "task-session-timeout",
  "claims": [
    {
      "id": "session-implementation",
      "pathPattern": "src/session.ts",
      "outcomeIds": ["reject-expired-session"],
      "reason": "Implements the requested expiry branch."
    },
    {
      "id": "session-tests",
      "pathPattern": "test/session.test.ts",
      "outcomeIds": ["reject-expired-session"],
      "reason": "Proves the requested behavior."
    }
  ]
}
```

## Rules

- `contractId` must equal the intent contract ID.
- Claim IDs must be unique.
- Every claim must name at least one outcome.
- Every named outcome must exist in the contract.
- The changed path must match the claim and at least one named outcome's path
  boundary.
- The file's change kind must be permitted by the outcome.
- Every hunk needs at least one valid claim.
- Catch-all patterns are rejected when the contract enables that control.

Claims are explicit evidence, not semantic proof. ScopeWitness can establish
that a claim is well-formed and bounded; it cannot establish that the prose
reason is honest. Reviewers should inspect the hunk-level ledger for sensitive
changes.

## Creating claims

Start with the inventory:

```bash
scope-witness inventory changes.diff --json
```

Create the narrowest practical path mapping. Prefer exact file paths when one
file serves one outcome. Use a bounded glob such as `src/session/**` when a
component legitimately spans several files.

Avoid using one claim for unrelated outcomes. A useful reason identifies the
specific role of the change, rather than repeating the outcome statement.
