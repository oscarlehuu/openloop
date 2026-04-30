# OpenLoop System Architecture

## Pipeline

```text
project path
  -> project scanner
  -> shared/meta/brief.json
  -> workflow-aware campaign generator
  -> modules/<module>/meta/ideas.json + modules/<module>/meta/slides.json
  -> workflow image strategy
  -> Codex OAuth image provider
  -> modules/<module>/raw/images/slide-XX.png
  -> local renderer or raw resizer
  -> modules/<module>/export/slides/slide-XX.png + optional caption + review preview
```

App Store screenshot source capture adds a pre-step before image generation:

```text
target iOS app
  -> screenshot mode audit or implementation via $develop-screenshot-mode
  -> Codex prompt
  -> XcodeBuildMCP compile/launch/navigate/screenshot
  -> shared/source/app-screenshots/slide-01.png ... slide-05.png
  -> OpenLoop app-store workflow
```

## Campaign Layout

Campaign output is module-first:

```text
.openloop/campaign/<campaign>/
  manifest.json
  shared/
    meta/brief.json
    source/app-screenshots/
  modules/
    social-slides/
    app-store-screenshots/
    app-ads/
```

Inside each module, lifecycle folders are stable:

```text
meta/      # workflow plan JSON and prompt metadata
raw/       # direct model or generator output
work/      # manual edits or intermediate composites when needed
export/    # upload/model-ready final assets
review/    # preview HTML, contact sheets, validation views
```

Common source truth lives in `shared/`. Workflow-specific files stay under `modules/<module>/`.

## Modules

- `src/cli`: CLI commands and command handlers.
- `src/config`: OpenLoop config schema and defaults.
- `src/runs`: campaign layout, run folder, and manifest handling.
- `src/scanner`: safe project source reader and project brief extraction.
- `src/workflows`: workflow definitions for asset count, roles, default preset, overlay mode, source-image import, and caption requirement.
- `src/workflows/image-generation-strategies.ts`: workflow-specific backend image instructions and source-image requirements.
- `src/campaign`: campaign idea and workflow-aware asset schema/generator.
- `src/providers`: image provider interface.
- `src/providers/codex-oauth`: Hermes-style Codex OAuth auth and image generation.
- `src/rendering`: local PNG rendering and caption/preview export.
- `src/validation`: run folder validator.
- `src/projects`: local project registry for dashboard tracking.
- `src/dashboard`: built-in local dashboard server, run indexer, and safe read-only file serving.
- `.agents/skills/develop-screenshot-mode`: repo-scoped Codex skill for preparing target apps with deterministic screenshot mode.

## Image Strategy

Image generation is workflow-specific even though both workflows use the same backend provider.

- Social slides use original no-text AI-generated 9:16 visuals. They do not need to show the real app.
- App Store screenshots require real app screenshots as source images. The backend may frame, polish, or crop, but must not invent app UI. Before planning, OpenLoop can fetch before.click references into `modules/app-store-screenshots/references/before-click/` and write `modules/app-store-screenshots/meta/style-brief.json`; those references are art direction only. Marketing text is still rendered locally.
- App ads require real app screenshots for post-production compositing. OpenLoop builds a screenshot contact sheet, then generates twelve portrait 2:3 single-shot video references. Video references must contain a chroma-green phone screen tracking card and no app UI pixels before they are attached one at a time to Seedance/Kling.
- App Store source screenshots should come from simulator capture whenever possible, not generated images.

OpenLoop generates copy as structured JSON, then renders text locally for upload assets.

## Screenshot Capture Boundary

OpenLoop should not own app-specific fake UI. Target apps own their screenshot mode. OpenLoop owns orchestration and asset generation.

The capture contract for target apps:

```text
SCREENSHOT_MODE=1
SCREENSHOT_SCENE=store-hook|main-use-case|key-feature|user-outcome|install-cta
SCREENSHOT_LOCALE=en-US
SCREENSHOT_DATE=2026-04-29T09:00:00Z
```

Each scene should expose a visible readiness marker:

```text
screenshot-ready-store-hook
screenshot-ready-main-use-case
screenshot-ready-key-feature
screenshot-ready-user-outcome
screenshot-ready-install-cta
```

Codex capture prompt source of truth:

```text
plans/reports/research-260429-1829-app-store-screenshot-generation-pipeline.md
```

## Workflows

- `social-carousel`: six 9:16 assets, overlay rendered locally, caption required.
- `app-store-screenshot`: five App Store assets generated from real app screenshots, optional before.click style references, 1320x2868 primary output, plus 1320x2868 iPhone 6.9", 1284x2778 iPhone 6.5", 2064x2752 iPad 13", and 2048x2732 iPad 12.9" export folders, overlay rendered locally, no caption required.
- `app-ads`: twelve portrait 2:3 single-shot references with chroma-green phone screen cards, raw/no local overlay, no real/photoreal people, shared and per-image Kling, Seedance, and model-agent prompt exports, no caption required. Generated video should be one 2-4 second plate per reference; exact app screenshots are overlaid after video generation.

## Auth Strategy

OpenLoop stores its own Codex OAuth session at `~/.openloop/auth.json`. It can import existing Codex CLI credentials, but does not write back to Codex CLI auth. This avoids refresh-token rotation conflicts.

## Integration Boundary

Postiz, Canva, and analytics are future integrations. Current local dashboard reads OpenLoop's own registry and generated `.openloop/campaign/` output only.

XcodeBuildMCP is a capture integration boundary. It is used by Codex to control simulator state and produce source screenshots, while OpenLoop consumes the resulting folder.
