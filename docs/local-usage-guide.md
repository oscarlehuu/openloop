# OpenLoop Local Usage Guide

## Setup

```bash
npm install
npm run openloop -- init
```

## Start Local Dashboard

Register projects you want OpenLoop to track:

```bash
npm run openloop -- project:add --path . --name LarryLoop
```

Start the local website:

```bash
npm run dev
```

The dashboard opens at the printed local URL, usually `http://127.0.0.1:5173`.
It lists registered projects, campaign runs, workflow type, asset status, preview links, and captions when a workflow has them.

## Create A Campaign Run

Run the full default pipeline:

```bash
openloop slides --project /path/to/project --name first-campaign
```

The run is written to `.openloop/campaign/first-campaign/`. If that folder already exists,
OpenLoop appends a timestamp to avoid overwriting it.

`slides` creates the social carousel workflow and exports 9:16 PNGs by default.
The default planner is `codex`, which reads the scanned product evidence and creates product-specific module files.

Use a direct command when the output is not a social slide set:

```bash
openloop app-store --project /path/to/app --name app-store-set --screenshots /path/to/real-screenshots
openloop app-ads --project /path/to/app --name launch-ad --screenshots /path/to/real-screenshots
```

Workflow defaults:

- `social-carousel`: six 9:16 assets, local text overlay, shared caption.
- `app-store-screenshot`: five App Store assets generated from real app screenshots, local text overlay, no caption required. It also tries to fetch before.click references for style inspiration without adding a CLI flag. It exports iPhone 6.9", iPhone 6.5", iPad 13", and iPad 12.9" target folders.
- `app-ads`: twelve portrait 2:3 single-shot scratch references with chroma-green phone screen cards, no local overlay, no caption required. Seedance prompts attach one clean video reference at a time; exact app screenshots are composited after generation to avoid hallucinated UI text/language drift.

Landing image generation is disabled for now.

## Prepare Target Apps For App Store Screenshots

Before asking Codex to capture screenshots for a target app, prepare that app with the repo skill:

```text
Use $develop-screenshot-mode to inspect QuickShift and add screenshot mode only if it is missing.
```

The skill lives at:

```text
.agents/skills/develop-screenshot-mode/
```

Expected app-side contract:

```text
SCREENSHOT_MODE=1
SCREENSHOT_SCENE=store-hook|main-use-case|key-feature|user-outcome|install-cta
```

Expected readiness markers:

```text
screenshot-ready-store-hook
screenshot-ready-main-use-case
screenshot-ready-key-feature
screenshot-ready-user-outcome
screenshot-ready-install-cta
```

Use this flow when automating source capture:

```text
OpenLoop decides screenshot set
  -> Codex receives capture prompt
  -> Codex uses XcodeBuildMCP on the target iOS app
  -> Codex writes slide-01.png ... slide-05.png
  -> OpenLoop consumes that folder with app-store workflow
```

Use the old deterministic template only for offline/debug runs:

```bash
openloop slides --project /path/to/project --name first-campaign --planner local
```

If image generation fails midway, resume the same run. Existing raw images are skipped by default:

```bash
openloop run:resume --run .openloop/campaign/<generated-run>
```

Force image regeneration when needed:

```bash
openloop generate:images --run .openloop/campaign/<generated-run> --force
```

OpenLoop still keeps each step as a separate command for debugging or manual edits:

```bash
npm run openloop -- scan --project /path/to/project --name first-campaign
npm run openloop -- generate:ideas --run .openloop/campaign/<generated-run> --planner codex
```

Review and edit these files before image generation if needed:

- `shared/meta/brief.json`
- `modules/<module>/meta/ideas.json`
- `modules/<module>/meta/slides.json`

`shared/meta/brief.json` includes safe source snippets from product docs, landing copy, App Store copy, and code signals. Sensitive names such as env, secret, token, and credential files are skipped.

## Codex OAuth

Fresh login:

```bash
npm run openloop -- auth:login codex
```

Import existing Codex CLI credentials into OpenLoop's own auth store:

```bash
npm run openloop -- auth:login codex --import-codex
```

OpenLoop stores credentials at `~/.openloop/auth.json`.

To switch accounts:

```bash
openloop auth:logout
openloop auth:login codex
```

To copy the currently logged-in Codex CLI account into OpenLoop:

```bash
openloop auth:login codex --import-codex
```

## Generate Images

```bash
npm run openloop -- generate:images --run .openloop/campaign/<generated-run>
```

This creates raw images for the run workflow:

```text
modules/<module>/raw/images/slide-01.png
...
modules/<module>/raw/images/slide-XX.png
```

For App Store runs, add real screenshots before image generation:

```text
shared/source/app-screenshots/slide-01.png
shared/source/app-screenshots/slide-02.png
...
shared/source/app-screenshots/slide-05.png
```

You can also set `sourceImagePath` per asset in `slides.json`. The backend uses those real images as source truth and will not invent app UI.

For App Store runs, OpenLoop also attempts a before.click inspiration pass before planning. If available, it writes:

```text
modules/app-store-screenshots/references/before-click/manifest.json
modules/app-store-screenshots/meta/style-brief.json
```

These references are style-only. The planner and image model may use them for composition, background, device treatment, color rhythm, and hierarchy, but final exports must preserve the real source screenshot as the only app UI.

For App Ads runs, pass the same real screenshots folder:

```bash
openloop app-ads --project /path/to/app --name launch-ad --screenshots /path/to/real-screenshots
```

OpenLoop copies up to five screenshots into `shared/source/app-screenshots/` and writes `shared/source/app-screenshots/contact-sheet.png`. App-ad generation keeps those screenshots for post-production only, then creates twelve single-shot video references with a chroma-green phone screen plane. During render, OpenLoop writes model-ready prompts beside each video reference.

For Seedance 2.0, attach one file from `modules/app-ads/export/video-references/images/` at a time and paste its matching prompt from `modules/app-ads/export/video-references/prompts/`. Do not attach all twelve references in one run, and do not attach `shared/source/app-screenshots/contact-sheet.png`. Generate 2-4 second green-screen phone plates, then overlay exact source app screenshots in post-production. This avoids hallucinated labels, translated text, and changed UI.

If you run `openloop app-store` without `--screenshots`, OpenLoop stops after writing the plan and prints the run path. Add real screenshots to that run, then resume:

```bash
openloop run:resume --run .openloop/campaign/<generated-run>
```

## Render Final Slides

```bash
npm run openloop -- render --run .openloop/campaign/<generated-run>
npm run openloop -- validate --run .openloop/campaign/<generated-run>
```

Final upload assets:

```text
modules/<module>/export/slides/slide-01.png
...
modules/<module>/export/slides/slide-XX.png
modules/social-slides/export/caption.txt      # social-carousel only
modules/<module>/review/preview.html
```

App Store screenshot workflow also writes target-specific folders:

```text
modules/app-store-screenshots/export/app-store/iphone-6-9/slide-01.png   # 1320x2868
modules/app-store-screenshots/export/app-store/iphone-6-5/slide-01.png   # 1284x2778
modules/app-store-screenshots/export/app-store/ipad-13/slide-01.png      # 2064x2752
modules/app-store-screenshots/export/app-store/ipad-12-9/slide-01.png    # 2048x2732
```

Use the same exported social carousel slides and caption for TikTok or Instagram first.

App Ads workflow also writes:

```text
modules/app-ads/export/video-prompts/kling.md
modules/app-ads/export/video-prompts/seedance.md
modules/app-ads/export/video-prompts/model-agent.md
modules/app-ads/export/video-references/images/slide-01.png
modules/app-ads/export/video-references/prompts/slide-01-seedance.md
modules/app-ads/export/video-references/prompts/slide-01-kling.md
modules/app-ads/export/video-references/prompts/slide-01-agent.md
modules/app-ads/export/video-references/images/slide-02.png
modules/app-ads/export/video-references/prompts/slide-02-seedance.md
modules/app-ads/export/video-references/prompts/slide-02-kling.md
modules/app-ads/export/video-references/prompts/slide-02-agent.md
shared/source/app-screenshots/contact-sheet.png
```
