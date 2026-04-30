# Contributing

OpenLoop is early and local-first. Keep contributions small, inspectable, and grounded in the existing CLI/dashboard workflow.

## Rules

- Keep source files focused and easy to scan.
- Use strict TypeScript and zod at file boundaries.
- Prefer JSON files over database state for local runtime data.
- Do not commit auth state, generated campaigns, local project registries, real customer data, or private screenshots.
- App Store screenshot workflows must use real app screenshots as source truth.
- Do not ask image models to invent app UI, labels, user accounts, or production data.

## Before Opening A PR

```sh
npm run typecheck
npm test
npm run build
```

## Security

Report security concerns privately. See [SECURITY.md](SECURITY.md).
