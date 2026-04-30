import { access, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { campaignIdeaSchema, slidesDocumentSchema } from "../campaign/slide-schema.js";
import { resolveOutputPreset } from "../config/output-presets.js";
import { appAdsVideoReferencePath, appAdsVideoReferencePromptPath } from "../rendering/app-ads-video-reference-assets.js";
import { finalSlideRelativePath, outputPresetDir, rawImageRelativePath } from "../runs/campaign-layout.js";
import { readJsonFile } from "../shared/json-file.js";
import { readManifest, type RunManifest } from "../runs/run-store.js";
import { resolveWorkflow, type WorkflowDefinition } from "../workflows/workflow-definitions.js";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateRun(runPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresCaption = true;
  let expectedAssetCount: number | undefined;
  let workflow: WorkflowDefinition | undefined;
  let manifest: RunManifest | undefined;
  try {
    manifest = await readManifest(runPath);
    workflow = resolveWorkflow(manifest.workflowId);
    requiresCaption = workflow.requiresCaption;
    expectedAssetCount = workflow.assetCount;
  } catch (error) {
    errors.push(`Invalid manifest: ${String(error)}`);
  }
  await validateJson(join(runPath, manifest?.files.ideas ?? "ideas.json"), campaignIdeaSchema, errors);
  const slides = await validateJson(join(runPath, manifest?.files.slides ?? "slides.json"), slidesDocumentSchema, errors);

  if (slides) {
    if (expectedAssetCount && slides.slides.length !== expectedAssetCount) {
      errors.push(`Workflow expects ${expectedAssetCount} assets, but slides.json has ${slides.slides.length}.`);
    }
    for (const slide of slides.slides) {
      const id = String(slide.slideNumber).padStart(2, "0");
      await requireFile(
        join(runPath, manifest ? rawImageRelativePath(manifest, slide.slideNumber) : `images/slide-${id}-raw.png`),
        warnings,
        "Missing raw image"
      );
      await requireFile(
        join(runPath, manifest ? finalSlideRelativePath(manifest, slide.slideNumber) : `exports/slides/slide-${id}.png`),
        warnings,
        "Missing rendered slide"
      );
      for (const target of workflowTargetDirectories(workflow, manifest)) {
        await requireFile(join(runPath, target, `slide-${id}.png`), warnings, "Missing workflow target slide");
      }
    }
  }
  if (requiresCaption) await requireFile(join(runPath, manifest?.files.caption ?? "caption.txt"), warnings, "Missing caption");
  if (workflow?.id === "app-ads") {
    const promptDir = manifest?.layoutVersion && manifest.layoutVersion >= 2
      ? "modules/app-ads/export/video-prompts"
      : "video-prompts";
    await requireFile(join(runPath, promptDir, "kling.md"), warnings, "Missing Kling prompt");
    await requireFile(join(runPath, promptDir, "seedance.md"), warnings, "Missing Seedance prompt");
    await requireFile(join(runPath, promptDir, "model-agent.md"), warnings, "Missing model agent prompt");
    for (const slide of slides?.slides ?? []) {
      const id = String(slide.slideNumber).padStart(2, "0");
      await requireAnyFile(
        [appAdsVideoReferencePath(runPath, slide.slideNumber), join(runPath, "exports", "video-references", `slide-${id}.png`)],
        warnings,
        "Missing clean video reference"
      );
      for (const model of ["kling", "seedance", "agent"]) {
        await requireAnyFile(
          [
            appAdsVideoReferencePromptPath(runPath, slide.slideNumber, model),
            join(runPath, "exports", "video-references", `slide-${id}-${model}.md`)
          ],
          warnings,
          `Missing per-image ${model} prompt`
        );
      }
    }
  }
  await requireFile(join(runPath, manifest?.files.preview ?? "exports/preview.html"), warnings, "Missing preview");
  return { ok: errors.length === 0, errors, warnings };
}

function workflowTargetDirectories(workflow?: WorkflowDefinition, manifest?: RunManifest): string[] {
  if (!workflow) return [];
  return workflow.outputPlatforms
    .map((platform) => resolveOutputPreset(platform).exportDir)
    .map((dir) => (dir && manifest ? outputPresetDir(manifest, dir) : dir))
    .filter((dir): dir is string => Boolean(dir));
}

async function validateJson<T>(
  path: string,
  schema: z.ZodType<T>,
  errors: string[]
): Promise<T | undefined> {
  try {
    return await readJsonFile(path, schema);
  } catch (error) {
    errors.push(`Invalid JSON ${path}: ${String(error)}`);
    return undefined;
  }
}

async function requireFile(path: string, warnings: string[], label: string): Promise<void> {
  try {
    await access(path);
    if ((await stat(path)).size === 0) warnings.push(`${label}: ${path} is empty`);
  } catch {
    warnings.push(`${label}: ${path}`);
  }
}

async function requireAnyFile(paths: string[], warnings: string[], label: string): Promise<void> {
  for (const path of paths) {
    try {
      await access(path);
      if ((await stat(path)).size === 0) warnings.push(`${label}: ${path} is empty`);
      return;
    } catch {
      // Try next compatibility path.
    }
  }
  warnings.push(`${label}: ${paths[0]}`);
}
