import { access } from "node:fs/promises";
import { join } from "node:path";
import type { RunManifest } from "./run-store.js";
import type { WorkflowDefinition, WorkflowId } from "../workflows/workflow-definitions.js";

const MODULE_BY_WORKFLOW: Record<WorkflowId, string> = {
  "social-carousel": "social-slides",
  "app-store-screenshot": "app-store-screenshots",
  "app-ads": "app-ads"
};

export interface CampaignLayout {
  moduleName: string;
  sharedMetaDir: string;
  sharedSourceAppScreenshotsDir: string;
  moduleRoot: string;
  moduleMetaDir: string;
  moduleReferencesDir: string;
  beforeClickReferencesDir: string;
  moduleRawImagesDir: string;
  moduleRawVideoReferencesDir: string;
  moduleExportDir: string;
  moduleFinalSlidesDir: string;
  moduleReviewDir: string;
  caption: string;
  preview: string;
  appAdsVideoReferencesDir: string;
  appAdsVideoReferencePromptsDir: string;
  appAdsVideoPromptsDir: string;
  sourceContactSheet: string;
}

export function campaignLayout(workflow: WorkflowDefinition): CampaignLayout {
  const moduleName = MODULE_BY_WORKFLOW[workflow.id];
  const moduleRoot = `modules/${moduleName}`;
  const sharedSourceAppScreenshotsDir = "shared/source/app-screenshots";
  return {
    moduleName,
    sharedMetaDir: "shared/meta",
    sharedSourceAppScreenshotsDir,
    moduleRoot,
    moduleMetaDir: `${moduleRoot}/meta`,
    moduleReferencesDir: `${moduleRoot}/references`,
    beforeClickReferencesDir: `${moduleRoot}/references/before-click`,
    moduleRawImagesDir: `${moduleRoot}/raw/images`,
    moduleRawVideoReferencesDir: `${moduleRoot}/raw/video-references`,
    moduleExportDir: `${moduleRoot}/export`,
    moduleFinalSlidesDir: `${moduleRoot}/export/slides`,
    moduleReviewDir: `${moduleRoot}/review`,
    caption: `${moduleRoot}/export/caption.txt`,
    preview: `${moduleRoot}/review/preview.html`,
    appAdsVideoReferencesDir: `${moduleRoot}/export/video-references/images`,
    appAdsVideoReferencePromptsDir: `${moduleRoot}/export/video-references/prompts`,
    appAdsVideoPromptsDir: `${moduleRoot}/export/video-prompts`,
    sourceContactSheet: `${sharedSourceAppScreenshotsDir}/contact-sheet.png`
  };
}

export function sourceImagePathForSlide(slideNumber: number, workflow: WorkflowDefinition): string | undefined {
  if (workflow.id !== "app-store-screenshot") return undefined;
  return `${campaignLayout(workflow).sharedSourceAppScreenshotsDir}/slide-${idFor(slideNumber)}.png`;
}

export function rawImageRelativePath(manifest: RunManifest, slideNumber: number): string {
  const fileName = manifest.files.imagesDir === "images" ? `slide-${idFor(slideNumber)}-raw.png` : `slide-${idFor(slideNumber)}.png`;
  return `${manifest.files.imagesDir}/${fileName}`;
}

export function finalSlideRelativePath(manifest: RunManifest, slideNumber: number): string {
  return `${manifest.files.finalSlidesDir}/slide-${idFor(slideNumber)}.png`;
}

export function outputPresetDir(manifest: RunManifest, presetExportDir: string): string {
  if (manifest.files.exportsDir === "exports") return presetExportDir;
  return join(manifest.files.exportsDir, presetExportDir.replace(/^exports\//, ""));
}

export function appAdsVideoReferenceRelativePath(workflow: WorkflowDefinition, slideNumber: number): string {
  return `${campaignLayout(workflow).appAdsVideoReferencesDir}/slide-${idFor(slideNumber)}.png`;
}

export function appAdsVideoReferencePromptRelativePath(
  workflow: WorkflowDefinition,
  slideNumber: number,
  model: string
): string {
  return `${campaignLayout(workflow).appAdsVideoReferencePromptsDir}/slide-${idFor(slideNumber)}-${model}.md`;
}

export async function firstExistingPath(paths: string[]): Promise<string | undefined> {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Try next path.
    }
  }
  return undefined;
}

export function idFor(slideNumber: number): string {
  return String(slideNumber).padStart(2, "0");
}
