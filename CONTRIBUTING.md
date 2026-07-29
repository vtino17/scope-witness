# Contributing

Thank you for helping improve ScopeWitness.

## Development

Requirements: Node.js 20+ and pnpm 10.14+.

```bash
pnpm install
pnpm check
pnpm dev
```

Keep the core package deterministic and usable in both Node.js and modern
browsers. New controls should include:

- an aligned case;
- a blocked or warning case;
- a stable issue code;
- CLI-readable output;
- documentation of the control and its limits.

## Pull requests

Keep pull requests focused, explain the user-facing behavior, and include tests.
Run `pnpm check` before submitting. Changes to contract semantics or receipt
hashing should describe compatibility implications.

By contributing, you agree that your contribution is licensed under the MIT
License.
