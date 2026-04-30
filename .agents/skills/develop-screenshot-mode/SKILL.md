---
name: develop-screenshot-mode
description: Add or refine deterministic screenshot mode in a mobile app so Codex/OpenLoop can capture truthful App Store source screenshots. Use when asked to prepare an app for automated App Store screenshots, add SCREENSHOT_MODE or demo fixtures, make XcodeBuildMCP screenshot capture reliable, seed app data for screenshots, or check whether screenshot mode already exists before implementing it. Always audit for existing screenshot/demo/fixture/deeplink support first; reuse or extend it instead of adding a parallel system.
---

# Develop Screenshot Mode

## Purpose

Prepare a target app to expose stable, truthful, simulator-capturable screens for later App Store screenshot generation. This skill develops the app-side screenshot mode only; it does not generate marketing art.

## Workflow

1. Read the target repo instructions first: `README.md`, `CLAUDE.md`, `AGENTS.md`, app docs, and platform build notes.
2. Find the app platform and entry points: SwiftUI/UIKit, React Native/Expo, Flutter, or other mobile shell.
3. Audit before editing. Search for existing screenshot/demo/test hooks using terms like `SCREENSHOT_MODE`, `screenshot`, `demo`, `fixture`, `seed`, `mock`, `deeplink`, `launchArguments`, `ProcessInfo`, `UITest`, `preview`, `AppStore`, and `accessibilityIdentifier`.
4. Decide:
   - If a screenshot mode exists and supports the needed scenes, document how to trigger it and avoid code changes.
   - If a partial mode exists, extend it minimally.
   - If no mode exists, add the smallest deterministic app-side mode.
5. Implement the mode behind explicit simulator/test-only flags where practical.
6. Validate by compiling. If XcodeBuildMCP or iOS Simulator tools are available, launch at least one scene and verify the readiness marker appears.
7. Report the exact contract for the capture agent: env vars, deeplinks, scene IDs, readiness markers, fixture files, and validation result.

## Required Contract

Use this default contract unless the app already has a better local convention:

```text
SCREENSHOT_MODE=1
SCREENSHOT_SCENE=store-hook|main-use-case|key-feature|user-outcome|install-cta
SCREENSHOT_LOCALE=en-US
SCREENSHOT_DATE=2026-04-29T09:00:00Z
```

Optional deeplink shape:

```text
myapp://screenshot/<scene-id>?fixture=app-store-v1
```

Each scene must expose a stable accessibility marker:

```text
screenshot-ready-store-hook
screenshot-ready-main-use-case
screenshot-ready-key-feature
screenshot-ready-user-outcome
screenshot-ready-install-cta
```

## Implementation Rules

- Keep fixtures local, deterministic, and realistic.
- Bypass login, onboarding randomness, paywall blockers, permission prompts, remote config, network fetches, analytics side effects, and time-dependent state while screenshot mode is active.
- Do not include secrets, real accounts, private messages, production customer data, or live API calls in screenshot fixtures.
- Do not invent product capabilities. Fixture data must represent real app functionality.
- Do not create a separate fake app shell if existing app screens can be reached with seeded state.
- Prefer routing into real screens with seeded stores/view models over screenshot-only mock UI.
- Freeze dates, random values, sort order, timers, animations, and loading states when they affect screenshot stability.
- Add clear accessibility identifiers only where needed for scene readiness and capture navigation.
- Keep changes narrow. Do not alter normal production behavior outside the screenshot mode gate.

## Platform Guidance

SwiftUI or UIKit:
- Read launch arguments and environment via `ProcessInfo.processInfo`.
- Inject screenshot fixtures through the existing app environment, store, dependency container, or root coordinator.
- Use `.accessibilityIdentifier("screenshot-ready-...")` on a stable visible container.
- Prefer compile-time debug guards when the app has a clear Debug-only configuration, but avoid making release screenshots impossible if the project intentionally captures release builds.

React Native or Expo:
- Read env/launch args through existing config, native constants, or a small native bridge if needed.
- Seed client stores, query caches, async storage, or navigation params before initial route render.
- Add `testID="screenshot-ready-..."` to the stable scene root.

Flutter:
- Read env or dart defines through existing configuration.
- Seed providers/blocs/repositories before routing.
- Add keys/semantics labels that the capture tool can detect.

## Validation

Run the smallest reliable compile check for the target app. For iOS, use XcodeBuildMCP when configured:

1. Show or set session defaults for project/workspace, scheme, simulator, and bundle id.
2. Build or build-and-launch the app.
3. Launch with `SCREENSHOT_MODE=1` and one `SCREENSHOT_SCENE`.
4. Inspect UI snapshot for the matching readiness marker.
5. Capture a simulator screenshot only as validation if useful; final screenshot capture belongs to the capture workflow.

If simulator validation is blocked by signing, missing runtime, package resolution, or unavailable device, report that blocker separately from code correctness.

## Output Format

End with:

```text
Screenshot mode: reused | extended | added | blocked
Scenes:
- store-hook -> trigger, fixture, readiness marker
- main-use-case -> trigger, fixture, readiness marker
- key-feature -> trigger, fixture, readiness marker
- user-outcome -> trigger, fixture, readiness marker
- install-cta -> trigger, fixture, readiness marker
Validation: command/tool used and result
Files changed: list
Next capture prompt inputs: app path, project/workspace, scheme, bundle id, simulator, output folder
Unresolved questions: list only if any
```
