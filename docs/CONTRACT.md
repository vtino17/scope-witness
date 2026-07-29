# Intent contract reference

An intent contract describes the outcomes a patch may pursue and the boundaries
it must respect. It is reviewed before the patch is audited.

## Minimal structure

```json
{
  "schemaVersion": "1.0",
  "id": "task-session-timeout",
  "summary": "Reject expired sessions and cover the behavior with tests.",
  "outcomes": [
    {
      "id": "reject-expired-session",
      "statement": "Expired sessions return an authentication error.",
      "pathPatterns": ["src/session.ts", "test/session.test.ts"],
      "requiredDiffTokens": ["SESSION_EXPIRED"],
      "allowedChangeKinds": ["modified"]
    }
  ],
  "rules": {
    "allowedPaths": ["src/**", "test/**"],
    "forbiddenPaths": [".env*", "**/*.pem"],
    "maxFiles": 4,
    "maxChangedLines": 80,
    "sourcePatterns": ["src/**"],
    "testPatterns": ["test/**", "tests/**"],
    "requireTestsForSourceChanges": true,
    "dependencyManifestPatterns": ["package.json", "**/package.json"],
    "workflowPatterns": [".github/workflows/**"],
    "allowDependencyChanges": false,
    "allowWorkflowChanges": false,
    "protectedPaths": [
      {
        "pattern": "src/auth/**",
        "approvalId": "security-review",
        "reason": "Authentication code requires security approval."
      }
    ],
    "disallowCatchAllClaims": true
  },
  "approvals": []
}
```

## Outcomes

Each outcome has:

- `id`: a stable identifier used by the claim manifest.
- `statement`: the human-readable requested result.
- `pathPatterns`: paths in which that outcome may be implemented.
- `requiredDiffTokens`: literal tokens that must appear in covered hunks.
- `allowedChangeKinds`: any of `added`, `modified`, `deleted`, or `renamed`.

An outcome is satisfied only when it has at least one accountable hunk and all
its required tokens occur in those hunks.

## Repository rules

`allowedPaths` is the outer boundary. A changed path must match at least one
entry and no `forbiddenPaths` entry. `maxFiles` and `maxChangedLines` cap patch
size.

When `requireTestsForSourceChanges` is true, a patch that matches any
`sourcePatterns` entry must also modify a path matching `testPatterns`.

Dependency manifests and workflows have independent gates because both can
change the effective behavior of code without touching application logic.

`protectedPaths` maps sensitive patterns to approval IDs. A required approval is
valid only when its ID appears in the top-level `approvals` array. Generate that
array in a trusted workflow; do not let the patch author self-approve.

When `disallowCatchAllClaims` is true, claims whose path pattern is `*`, `**`,
or `**/*` are blocked.

## Glob semantics

ScopeWitness uses repository-relative paths:

- `*` matches within one path segment.
- `**` matches across path segments.
- `?` matches one non-separator character.
- A leading `!` is not interpreted as negation; use `forbiddenPaths` instead.

## Versioning

The current `schemaVersion` is `1.0`. Unknown fields are ignored, while missing
or invalid required fields are rejected. Pin the contract in version control
and run `scope-witness diff` when it changes.
