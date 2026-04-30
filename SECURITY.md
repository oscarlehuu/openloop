# Security Policy

## Supported Versions

OpenLoop is pre-1.0. Security fixes target the latest `main` branch.

## Sensitive Data Rules

- Do not commit `.env` files, auth stores, API keys, tokens, generated campaign output, local project registries, or screenshots containing private data.
- OpenLoop stores Codex OAuth credentials at `~/.openloop/auth.json`.
- Generated assets belong under `.openloop/campaign/` and are ignored by default.
- `openloop.projects.json` is local machine state and is ignored by default.

## Reporting

Open a private GitHub security advisory if available, or contact the maintainer directly before publishing details.
