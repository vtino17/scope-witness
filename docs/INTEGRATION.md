# Integration guide

## Pull-request gate

Commit a reviewed contract and claim manifest under `.scope-witness/`, then
capture the pull request diff and run the audit:

```bash
git diff --binary origin/main...HEAD > .scope-witness/pull-request.diff
scope-witness audit .scope-witness/contract.json \
  --patch .scope-witness/pull-request.diff \
  --claims .scope-witness/claims.json
```

A blocked result exits with code `2`. A warning exits with code `3`.

## GitHub Actions

```yaml
name: scope

on:
  pull_request:

jobs:
  witness:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10.14.0
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: git diff --binary "${{ github.event.pull_request.base.sha }}...HEAD" > changes.diff
      - run: pnpm scope audit .scope-witness/contract.json --patch changes.diff --claims .scope-witness/claims.json
```

For protected approvals, construct a temporary contract from trusted repository
metadata or environment state. Do not accept approval IDs from files modified
by the same pull request.

## Receipt artifact

After an aligned audit:

```bash
scope-witness receipt .scope-witness/contract.json \
  --patch changes.diff \
  --claims .scope-witness/claims.json \
  --output scope-receipt.json

scope-witness verify scope-receipt.json \
  --contract .scope-witness/contract.json \
  --claims .scope-witness/claims.json \
  --patch changes.diff
```

Store the receipt as a build artifact or attach it to a release. The receipt
binds the exact contract, claims, patch, and audit through SHA-256 hashes.

## Contract change gate

If a pull request modifies the contract, compare it with the base revision:

```bash
git show origin/main:.scope-witness/contract.json > previous-contract.json
scope-witness diff previous-contract.json .scope-witness/contract.json
```

The command exits with code `4` when it detects weakened controls.

## Adoption path

1. Begin with path boundaries and generous budgets.
2. Add one outcome for each independently reviewable requested result.
3. Enable source-to-test coupling.
4. Gate dependency and workflow changes.
5. Add protected paths and trusted approval issuance.
6. Archive receipts for high-risk changes.
