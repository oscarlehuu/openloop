# OpenLoop Project Overview

## Product

OpenLoop is a local-first marketing asset generator. It scans a local project, creates a compact campaign brief, generates workflow-specific image plans, creates raw images through Codex OAuth, optionally overlays copy locally, and exports upload-ready PNGs.

## V0 Scope

- Local CLI and local dashboard only.
- Workflow-aware asset planning for social carousel, App Store screenshots, and mobile app ads.
- Social slide generation uses original no-text 9:16 AI visuals.
- App Store screenshot generation uses real app screenshots as source images.
- App Store screenshot generation can fetch before.click references automatically for art direction, then keeps final assets original and grounded in the real app screenshots.
- App ad generation copies real app screenshots for post-production compositing, then creates twelve clean single-shot video references with chroma-green phone screens for Seedance/Kling.
- Local text overlay only for workflows that need final marketing copy in the image.
- Workflow-specific export presets, including TikTok/Instagram and iPhone/iPad App Store.
- App Store screenshot workflow exports iPhone 6.9", iPhone 6.5", iPad 13", and iPad 12.9" target folders.
- App ads workflow exports twelve portrait 2:3 single-shot video references and shared/per-image Kling, Seedance, and model-agent prompts. Clean video references avoid real/photoreal people and app UI pixels. Seedance prompts target one 2-4 second live-action-looking plate at a time with a chroma-green phone screen card; exact app UI is preserved through post-production screenshot overlay, not video-model redraw.
- Shared caption file for social carousel only.
- Manual upload by the user.
- App Store screenshot source capture is a planned automation layer: OpenLoop asks Codex to capture real target-app screenshots, and Codex uses XcodeBuildMCP for simulator control.

## Out Of Scope

- Postiz posting.
- Canva editing.
- Analytics and revenue attribution.
- SaaS dashboard and team accounts.
- Fully automated social scheduling.
- AI-invented app UI for App Store screenshots.

## Current Screenshot Automation Direction

Target apps are generic, but QuickShift is the first practical target.

Required app-side preparation lives in the repo-scoped skill:

```text
.agents/skills/develop-screenshot-mode/
```

Use the skill before capture automation:

```text
Use $develop-screenshot-mode to inspect QuickShift and add screenshot mode only if it is missing.
```

The skill must always audit existing screenshot/demo/fixture/deeplink support first. If support exists, reuse or extend it. If support is missing, add the smallest deterministic screenshot mode with `SCREENSHOT_MODE=1`, `SCREENSHOT_SCENE=<scene>`, local fixture data, and readiness markers such as `screenshot-ready-key-feature`.

## User Flow

```text
openloop init
openloop auth:login codex
openloop slides --project /path/to/project --name launch
Use $develop-screenshot-mode on the target app if screenshot mode is missing
Codex captures real target-app screenshots with XcodeBuildMCP
openloop app-store --project /path/to/app --name app-store-set --screenshots /path/to/real-screenshots
openloop app-ads --project /path/to/app --name launch-ad --screenshots /path/to/real-screenshots
npm run openloop -- project:add --path /path/to/project --name launch
npm run dev
```

## Output

```text
.openloop/campaign/<campaign>/
  manifest.json
  shared/
    meta/brief.json
    source/app-screenshots/slide-01.png ... slide-XX.png
    source/app-screenshots/contact-sheet.png
  modules/
    social-slides/
      meta/ideas.json
      meta/slides.json
      raw/images/slide-01.png ... slide-06.png
      export/slides/slide-01.png ... slide-06.png
      export/caption.txt
      review/preview.html
    app-store-screenshots/
      meta/ideas.json
      meta/slides.json
      meta/style-brief.json
      references/before-click/manifest.json
      raw/images/slide-01.png ... slide-05.png
      export/slides/slide-01.png ... slide-05.png
      export/app-store/iphone-6-9/slide-01.png
      review/preview.html
    app-ads/
      meta/ideas.json
      meta/slides.json
      raw/images/slide-01.png ... slide-12.png
      export/slides/slide-01.png ... slide-12.png
      export/video-prompts/kling.md
      export/video-prompts/seedance.md
      export/video-prompts/model-agent.md
      export/video-references/images/slide-01.png
      export/video-references/prompts/slide-01-seedance.md
      export/video-references/prompts/slide-01-kling.md
      export/video-references/prompts/slide-01-agent.md
      review/preview.html
```
