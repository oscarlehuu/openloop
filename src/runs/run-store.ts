import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { OpenLoopConfig } from "../config/openloop-config.js";
import { readJsonFile, writeJsonFile } from "../shared/json-file.js";
import { slugify, timestampSlug } from "../shared/path-utils.js";
import { DEFAULT_WORKFLOW_ID, resolveWorkflow, WORKFLOW_IDS } from "../workflows/workflow-definitions.js";
import { campaignLayout } from "./campaign-layout.js";

export const runManifestSchema = z.object({
  schemaVersion: z.literal(1),
  layoutVersion: z.number().int().min(1).default(1),
  moduleName: z.string().optional(),
  runId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  projectPath: z.string().optional(),
  workflowId: z.enum(WORKFLOW_IDS).default(DEFAULT_WORKFLOW_ID),
  slidesCount: z.number().int().min(1),
  status: z.enum(["created", "scanned", "planned", "imaged", "rendered"]),
  files: z.object({
    brief: z.string(),
    ideas: z.string(),
    slides: z.string(),
    imagesDir: z.string(),
    exportsDir: z.string(),
    finalSlidesDir: z.string(),
    caption: z.string(),
    preview: z.string()
  })
});

export type RunManifest = z.infer<typeof runManifestSchema>;

export function manifestPath(runPath: string): string {
  return join(runPath, "manifest.json");
}

export async function readManifest(runPath: string): Promise<RunManifest> {
  return readJsonFile(manifestPath(runPath), runManifestSchema);
}

export async function writeManifest(runPath: string, manifest: RunManifest): Promise<void> {
  await writeJsonFile(manifestPath(runPath), manifest);
}

export async function createRun(options: {
  cwd?: string;
  config: OpenLoopConfig;
  name: string;
  projectPath?: string;
  workflowId?: string;
}): Promise<{ runPath: string; manifest: RunManifest }> {
  const cwd = options.cwd ?? process.cwd();
  const workflow = resolveWorkflow(options.workflowId);
  const campaignSlug = slugify(options.name);
  const { runId, runPath } = await createUniqueCampaignDirectory(
    resolve(cwd, options.config.outputDirectory),
    campaignSlug
  );
  const layout = campaignLayout(workflow);
  await Promise.all([
    mkdir(join(runPath, layout.sharedMetaDir), { recursive: true }),
    mkdir(join(runPath, layout.sharedSourceAppScreenshotsDir), { recursive: true }),
    mkdir(join(runPath, layout.moduleMetaDir), { recursive: true }),
    mkdir(join(runPath, layout.moduleReferencesDir), { recursive: true }),
    mkdir(join(runPath, layout.moduleRawImagesDir), { recursive: true }),
    mkdir(join(runPath, layout.moduleExportDir), { recursive: true }),
    mkdir(join(runPath, layout.moduleFinalSlidesDir), { recursive: true }),
    mkdir(join(runPath, layout.moduleReviewDir), { recursive: true })
  ]);

  const manifest: RunManifest = {
    schemaVersion: 1,
    layoutVersion: 2,
    moduleName: layout.moduleName,
    runId,
    name: options.name,
    createdAt: new Date().toISOString(),
    projectPath: options.projectPath ? resolve(options.projectPath) : undefined,
    workflowId: workflow.id,
    slidesCount: workflow.assetCount,
    status: "created",
    files: {
      brief: `${layout.sharedMetaDir}/brief.json`,
      ideas: `${layout.moduleMetaDir}/ideas.json`,
      slides: `${layout.moduleMetaDir}/slides.json`,
      imagesDir: layout.moduleRawImagesDir,
      exportsDir: layout.moduleExportDir,
      finalSlidesDir: layout.moduleFinalSlidesDir,
      caption: layout.caption,
      preview: layout.preview
    }
  };
  await writeManifest(runPath, manifest);
  return { runPath, manifest };
}

async function createUniqueCampaignDirectory(rootPath: string, campaignSlug: string): Promise<{ runId: string; runPath: string }> {
  await mkdir(rootPath, { recursive: true });
  const stamp = timestampSlug();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const runId = campaignRunId(campaignSlug, stamp, attempt);
    const runPath = join(rootPath, runId);
    try {
      await mkdir(runPath);
      return { runId, runPath };
    } catch (error) {
      if (!isPathExistsError(error)) throw error;
    }
  }
  throw new Error(`Unable to create campaign directory for ${campaignSlug}`);
}

function campaignRunId(campaignSlug: string, stamp: string, attempt: number): string {
  if (attempt === 0) return campaignSlug;
  if (attempt === 1) return `${campaignSlug}-${stamp}`;
  return `${campaignSlug}-${stamp}-${attempt}`;
}

function isPathExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

export async function updateManifestStatus(
  runPath: string,
  status: RunManifest["status"]
): Promise<RunManifest> {
  const manifest = await readManifest(runPath);
  const next = { ...manifest, status };
  await writeManifest(runPath, next);
  return next;
}

export async function updateManifestWorkflow(runPath: string, workflowId: string): Promise<RunManifest> {
  const workflow = resolveWorkflow(workflowId);
  const manifest = await readManifest(runPath);
  const layout = campaignLayout(workflow);
  if (manifest.layoutVersion >= 2) {
    await Promise.all([
      mkdir(join(runPath, layout.moduleMetaDir), { recursive: true }),
      mkdir(join(runPath, layout.moduleReferencesDir), { recursive: true }),
      mkdir(join(runPath, layout.moduleRawImagesDir), { recursive: true }),
      mkdir(join(runPath, layout.moduleExportDir), { recursive: true }),
      mkdir(join(runPath, layout.moduleFinalSlidesDir), { recursive: true }),
      mkdir(join(runPath, layout.moduleReviewDir), { recursive: true })
    ]);
  }
  const next = {
    ...manifest,
    workflowId: workflow.id,
    moduleName: layout.moduleName,
    slidesCount: workflow.assetCount,
    files:
      manifest.layoutVersion >= 2
        ? {
            ...manifest.files,
            ideas: `${layout.moduleMetaDir}/ideas.json`,
            slides: `${layout.moduleMetaDir}/slides.json`,
            imagesDir: layout.moduleRawImagesDir,
            exportsDir: layout.moduleExportDir,
            finalSlidesDir: layout.moduleFinalSlidesDir,
            caption: layout.caption,
            preview: layout.preview
          }
        : manifest.files
  };
  await writeManifest(runPath, next);
  return next;
}
