# Threat model

ScopeWitness assumes that a coding agent or contributor may accidentally or
deliberately include changes beyond the authorized task.

## Assets

- The reviewed intent contract
- The integrity of the patch being audited
- The mapping from hunks to requested outcomes
- Trusted approvals for protected paths
- The audit decision and receipt

## Threats addressed

| Threat | Control |
| --- | --- |
| Unrelated file added to a plausible patch | Allowed paths and orphan-hunk detection |
| Hidden edit inside an otherwise claimed file | Every hunk receives its own audit record |
| Oversized patch that is difficult to review | File and changed-line budgets |
| Production change without tests | Source-to-test coupling |
| Surprise package or CI modification | Dependency and workflow gates |
| Sensitive file changed without review | Protected paths and approval IDs |
| One vague claim used for the entire repository | Catch-all claim rejection |
| Policy relaxed immediately before evaluation | Contract weakening diff |
| Receipt copied to a different patch | Content hashes and receipt verification |

## Trust assumptions

- The audit runs against the exact diff that will be merged or deployed.
- The baseline contract is obtained from a trusted revision.
- Protected approval IDs are issued by a trusted process.
- The SHA-256 implementation and execution environment are trustworthy.
- Reviewers understand that a valid claim is not proof that its prose is true.

## Out of scope

ScopeWitness does not:

- determine whether code is correct, secure, or free of vulnerabilities;
- infer user intent from chat transcripts;
- prove that a natural-language reason is honest;
- authenticate human identities or issue approvals;
- replace tests, code review, static analysis, or sandboxing;
- parse semantic language-level edits beyond unified-diff structure;
- sign receipts with a private key.

## Important limitations

Hunk boundaries are supplied by the diff producer. A large hunk can contain
both relevant and irrelevant lines, so reviewers should still inspect broad
hunks. Binary files have no auditable line content and are blocked.

A receipt is tamper-evident, not identity-authenticated. Systems that need
non-repudiation should sign the receipt externally and bind it to the commit
SHA.

Patterns are evaluated against repository-relative paths. Normalize and produce
diffs from a trusted checkout to avoid ambiguity.

## Recommended deployment

Run ScopeWitness after tests and static analysis, against the final staged or
pull-request diff. Keep the approved contract in a protected branch. Generate
approval IDs outside the contributor-controlled patch, retain the JSON audit,
and require human review for authentication, authorization, release, secret,
dependency, or workflow changes.
