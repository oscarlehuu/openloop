import { readdir, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { z } from "zod";
import { campaignIdeaSchema, slidesDocumentSchema } from "../campaign/slide-schema.js";
import { DEFAULT_OUTPUT_DIRECTORY, readConfig } from "../config/openloop-config.js";
import { ProjectEntry } from "../projects/project-registry.js";
import { finalSlideRelativePath, rawImageRelativePath } from "../runs/campaign-layout.js";
import { runManifestSchema, type RunManifest } from "../runs/run-store.js";
import { OpenLoopError } from "../shared/errors.js";
import { resolveWorkflow } from "../workflows/workflow-definitions.js";

export interface CampaignSummary {
  runId: string;
  runPath: string;
  name: string;
  createdAt: string;
  status: RunManifest["status"];
  projectPath?: string;
  workflowId: string;
  workflowLabel: string;
  assetLabel: string;
  slidesCount: number;
  previewUrl?: string;
  captionUrl?: string;
}

export interface ProjectWithCampaigns extends ProjectEntry {
  campaigns: CampaignSummary[];
}

export async function listProjectCampaigns(
  projects: ProjectEntry[],
  cwd = process.cwd()
): Promise<ProjectWithCampaigns[]> {
  const campaigns = await listCampaignRuns(cwd);
  return projects.map((project) => ({
    ...project,
    campaigns: campaigns.filter((run) => run.projectPath === project.path)
  }));
}

export async function listCampaignRuns(cwd = process.cwd()): Promise<CampaignSummary[]> {
  const outputDirectory = await readOutputDirectory(cwd);
  const runsRoot = resolve(cwd, outputDirectory);
  let entries: string[];
  try {
    entries = await readdir(runsRoot);
  } catch {
    return [];
  }

  const campaigns = await Promise.all(
    entries.map(async (entry) => readCampaignSummary(runsRoot, entry))
  );
  return campaigns
    .filter((campaign): campaign is CampaignSummary => Boolean(campaign))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readRunDetails(runId: string, cwd = process.cwd()): Promise<unknown> {
  const outputDirectory = await readOutputDirectory(cwd);
  const rootPath = resolve(cwd, outputDirectory);
  const runPath = safeRunPath(rootPath, runId);
  const manifest = await readRunManifest(runPath);
  const workflow = resolveWorkflow(manifest.workflowId);
  const [brief, idea, slides, caption] = await Promise.all([
    readOptionalUntypedJson(join(runPath, manifest.files.brief)),
    readOptionalJson(join(runPath, manifest.files.ideas), campaignIdeaSchema),
    readOptionalJson(join(runPath, manifest.files.slides), slidesDocumentSchema),
    readOptionalText(join(runPath, manifest.files.caption))
  ]);

  return {
    manifest,
    workflow: {
      id: workflow.id,
      label: workflow.label,
      assetLabel: workflow.assetLabel
    },
    brief,
    idea,
    caption,
    slides: slides
      ? slides.slides.map((slide) => {
          const id = String(slide.slideNumber).padStart(2, "0");
          return {
            ...slide,
            title: slide.overlayText?.headline ?? humanizeRole(slide.role),
            rawImageUrl: runFileUrl(runId, rawImageRelativePath(manifest, slide.slideNumber)),
            renderedSlideUrl: runFileUrl(runId, finalSlideRelativePath(manifest, slide.slideNumber))
          };
        })
      : [],
    previewUrl: runFileUrl(runId, manifest.files.preview),
    captionUrl: workflow.requiresCaption ? runFileUrl(runId, manifest.files.caption) : undefined
  };
}

export async function runsRootPath(cwd = process.cwd()): Promise<string> {
  return resolve(cwd, await readOutputDirectory(cwd));
}

function safeRunPath(rootPath: string, runId: string): string {
  const runPath = resolve(rootPath, runId);
  const rootWithSeparator = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  if (runPath !== rootPath && runPath.startsWith(rootWithSeparator)) return runPath;
  throw new OpenLoopError("Run path is outside the campaign directory.", "RUN_PATH_FORBIDDEN");
}

async function readCampaignSummary(
  runsRoot: string,
  runId: string
): Promise<CampaignSummary | undefined> {
  const runPath = join(runsRoot, runId);
  try {
    const manifest = await readRunManifest(runPath);
    const workflow = resolveWorkflow(manifest.workflowId);
    return {
      runId: manifest.runId,
      runPath,
      name: manifest.name,
      createdAt: manifest.createdAt,
      status: manifest.status,
      projectPath: manifest.projectPath,
      workflowId: workflow.id,
      workflowLabel: workflow.label,
      assetLabel: workflow.assetLabel,
      slidesCount: manifest.slidesCount,
      previewUrl: runFileUrl(manifest.runId, manifest.files.preview),
      captionUrl: workflow.requiresCaption ? runFileUrl(manifest.runId, manifest.files.caption) : undefined
    };
  } catch {
    return undefined;
  }
}

function runFileUrl(runId: string, relativePath: string): string {
  const encodedPath = relativePath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `/runs/${encodeURIComponent(runId)}/${encodedPath}`;
}

async function readOutputDirectory(cwd: string): Promise<string> {
  try {
    const outputDirectory = (await readConfig(cwd)).outputDirectory;
    return outputDirectory === "runs" ? DEFAULT_OUTPUT_DIRECTORY : outputDirectory;
  } catch {
    return DEFAULT_OUTPUT_DIRECTORY;
  }
}

async function readRunManifest(runPath: string): Promise<RunManifest> {
  return runManifestSchema.parse(JSON.parse(await readFile(join(runPath, "manifest.json"), "utf8")));
}

async function readOptionalJson<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return schema.parse(parsed);
  } catch {
    return null;
  }
}

async function readOptionalUntypedJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readOptionalText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function humanizeRole(role: string): string {
  return role
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
