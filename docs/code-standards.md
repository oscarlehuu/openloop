# OpenLoop Code Standards

## Principles

- Keep V0 local-first and CLI-first.
- Prefer simple JSON files over database state.
- Keep modules focused and under roughly 200 lines when practical.
- Use kebab-case file names.
- Do not log auth credentials.
- Keep image generation and text rendering separate.
- Keep workflow image strategies separate: social slides can use generated visuals, App Store screenshots must start from real app screenshots, and App Ads should keep screenshots for post-production compositing only.
- For App Store screenshots, never ask an image model to invent app UI, labels, product states, accounts, or feature results.
- App Store inspiration references such as before.click are style-only inputs. Do not copy reference brands, UI, text, logos, or exact layouts into final exports.
- For App Ads, never attach screenshot contact sheets to Seedance/Kling; use one clean chroma-green single-shot video reference per generation and composite exact screenshots later.
- Screenshot source capture must use deterministic app-side fixtures or real simulator state, not production customer data.

## TypeScript

- Use strict TypeScript.
- Use `zod` schemas at file boundaries.
- Use explicit domain errors through `OpenLoopError`.
- Prefer small pure functions for scanner, generator, and renderer helpers.

## Files

- Generated campaign output belongs under `.openloop/campaign/`.
- New campaign output uses module-first layout: common files in `shared/`, workflow files in `modules/<module>/`.
- Within each module, keep lifecycle folders stable: `meta/`, `references/`, `raw/`, `work/`, `export/`, and `review/`.
- Do not write new workflow assets to legacy root-level `images/`, `exports/`, `screenshots/`, `references/`, or `video-prompts/` folders.
- Docs belong under `docs/`.
- Plans and research belong under `plans/`.
- Repo-scoped Codex skills belong under `.agents/skills/`.
- Do not commit auth state or generated campaign assets unless explicitly needed.
- Keep hidden agent folders excluded from product scanning so skill text does not pollute campaign briefs.

## Agent Skills

- Maintain reusable project skills in `.agents/skills/` so future Codex sessions can load the same workflow.
- The current screenshot preparation skill is `.agents/skills/develop-screenshot-mode/`.
- A screenshot-mode skill must always audit existing app support first, then reuse, extend, or add mode in that order.
- Skill folders should contain only necessary skill files such as `SKILL.md` and `agents/openai.yaml`; avoid extra README/changelog clutter inside skill folders.

## Validation

Run before finishing changes:

```bash
npm run typecheck
npm test
```
