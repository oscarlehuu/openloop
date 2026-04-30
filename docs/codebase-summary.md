# OpenLoop Codebase Summary

## Current Context

OpenLoop is the active product in this repository. It is a local-first CLI and dashboard for turning project context into marketing assets.

The current priority is mobile-app creative generation. App Store assets and App Ads must start from real app screenshots. AI may frame, polish, and compose around screenshots, but must not invent app UI or product states.

## Core Workflow

```text
target project
  -> scan product evidence
  -> write shared/meta/brief.json
  -> plan workflow assets
  -> write modules/<module>/meta/ideas.json + modules/<module>/meta/slides.json
  -> generate modules/<module>/raw/images
  -> render local overlay copy
  -> export modules/<module>/export assets
```

Campaign output lives under `.openloop/campaign/<campaign-name>/`. Treat repo-root `runs/` as legacy compatibility only.

New campaign layout is module-first:
- common scan/source truth: `shared/meta/` and `shared/source/`
- social carousel files: `modules/social-slides/`
- App Store screenshot files: `modules/app-store-screenshots/`
- App Ads files: `modules/app-ads/`
- each module uses `meta/`, `raw/`, `work/`, `export/`, and `review/` lifecycle folders

## App Store Screenshot Direction

OpenLoop already supports `app-store-screenshot`:
- five assets
- real source screenshots in `shared/source/app-screenshots/slide-01.png` through `shared/source/app-screenshots/slide-05.png`
- optional before.click inspiration in `modules/app-store-screenshots/references/before-click/`
- generated style brief at `modules/app-store-screenshots/meta/style-brief.json`
- local text overlay
- export targets under `modules/app-store-screenshots/export/app-store/`

## App Ads Direction

OpenLoop supports `app-ads`:
- twelve generated scratch-style single-shot assets: `shot-01-roster-pressure` through `shot-12-final-outcome`
- real source screenshots copied into `shared/source/app-screenshots/`
- contact sheet at `shared/source/app-screenshots/contact-sheet.png`
- portrait 2:3 shot-reference outputs in `modules/app-ads/export/slides/`
- clean chroma-green phone video-model inputs in `modules/app-ads/export/video-references/images/`
- shared video-model prompts in `modules/app-ads/export/video-prompts/`
- per-image model prompts in `modules/app-ads/export/video-references/prompts/`

This workflow is for creating app-ad video-model references, not final social slides. Source screenshots are copied for later compositing only. Video references must avoid app UI pixels, real people, and photoreal people; use scratch drawings, faceless silhouettes, line-art hands, hospitality context, drawn phone frames, and chroma-green tracking cards.

Seedance should not be trusted to preserve app UI text from reference images. App-ads prompts should ask for one 2-4 second live-action plate per reference with a physical chroma-green phone screen card, then use the original screenshots for post-production overlay. This avoids hallucinated UI, translated labels, and changed text.

Next direction: OpenLoop should orchestrate Codex to capture real screenshots. Codex then uses XcodeBuildMCP to build, launch, navigate, and screenshot the target iOS app.

Target apps are generic, but first practical target can be QuickShift.

## Screenshot Mode Skill

Repo-scoped skill:

```text
.agents/skills/develop-screenshot-mode/
```

Use it before capture automation work:

```text
Use $develop-screenshot-mode to inspect QuickShift and add screenshot mode only if it is missing.
```

The skill's job is app-side preparation only:
- audit existing screenshot/demo/fixture/deeplink support first
- reuse or extend existing support when available
- add `SCREENSHOT_MODE=1` and `SCREENSHOT_SCENE=<scene>` only when missing
- seed deterministic local fixtures
- expose readiness markers like `screenshot-ready-key-feature`
- validate with build/simulator tooling when possible

Hidden folders such as `.agents` must stay excluded from product scanning so agent instructions do not pollute campaign evidence.

## Key Docs

- `docs/project-overview-pdr.md`: product scope and user flow
- `docs/system-architecture.md`: pipeline, module map, integration boundaries
- `docs/local-usage-guide.md`: CLI usage
- `docs/code-standards.md`: implementation rules
- `plans/reports/research-260429-1829-app-store-screenshot-generation-pipeline.md`: current screenshot research and Codex capture prompt

## Open Questions

- Exact QuickShift repo path, Xcode scheme, and bundle id.
- Exact first five QuickShift App Store scenes.
- Whether the first QuickShift screenshot mode should use env-only routing or deeplinks.
