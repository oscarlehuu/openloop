import { join, resolve } from "node:path";
import { parsePlannerMode, planCampaign } from "../campaign/campaign-planner.js";
import { defaultConfig, ensureConfig, configPath } from "../config/openloop-config.js";
import { prepareAppStoreInspiration } from "../inspiration/app-store-inspiration.js";
import {
  clearCodexCredentials,
  importCodexCliCredentials,
  readCodexCredentials
} from "../providers/codex-oauth/codex-auth-store.js";
import { loginWithCodexDeviceCode } from "../providers/codex-oauth/codex-device-login.js";
import { readProjectRegistry, removeProject, upsertProject } from "../projects/project-registry.js";
import { createRun, readManifest, updateManifestStatus, updateManifestWorkflow } from "../runs/run-store.js";
import { scanProject, projectBriefSchema } from "../scanner/project-scanner.js";
import { OpenLoopError } from "../shared/errors.js";
import { readJsonFile, writeJsonFile } from "../shared/json-file.js";
import { resolveWorkflow, workflowOptionList } from "../workflows/workflow-definitions.js";
import { generateImagesForRun } from "./image-generation-runner.js";
import { renderRun, resumeRunPipeline, runFullPipeline, validateRunAndReport } from "./run-pipeline.js";

export async function initCommand(force = false): Promise<void> {
  if (!force) {
    await ensureConfig();
  } else {
    await writeJsonFile(configPath(), defaultConfig());
  }
  console.log(`Config ready: ${configPath()}`);
}

export async function newRunCommand(name: string, project?: string, workflowId?: string): Promise<void> {
  const config = await ensureConfig();
  const workflow = resolveWorkflow(workflowId);
  const { runPath } = await createRun({ config, name, projectPath: project, workflowId: workflow.id });
  console.log(`Run created: ${runPath}`);
  console.log(`Workflow: ${workflow.label}`);
}

export async function doctorCommand(): Promise<void> {
  const config = await ensureConfig();
  const credentials = await readCodexCredentials();
  console.log(`Config: ${configPath()}`);
  console.log(`Slides: ${config.defaultSlides}`);
  console.log(`Image provider: ${config.imageProvider}`);
  console.log(`Codex auth: ${credentials ? "present" : "missing"}`);
}

export async function projectAddCommand(
  projectPath: string,
  name?: string,
  tags?: string
): Promise<void> {
  const result = await upsertProject({
    projectPath,
    name,
    tags: tags?.split(",")
  });
  console.log(`${result.created ? "Project registered" : "Project updated"}: ${result.project.name}`);
  console.log(`ID: ${result.project.id}`);
  console.log(`Path: ${result.project.path}`);
}

export async function projectListCommand(): Promise<void> {
  const registry = await readProjectRegistry();
  console.log(JSON.stringify(registry.projects, null, 2));
}

export async function projectRemoveCommand(idOrPath: string): Promise<void> {
  const removed = await removeProject(idOrPath);
  console.log(removed ? `Project removed: ${idOrPath}` : `Project not found: ${idOrPath}`);
}

export async function scanCommand(project: string, run?: string, name = "campaign", workflowId?: string): Promise<void> {
  const config = await ensureConfig();
  const workflow = resolveWorkflow(workflowId);
  const created = run ? undefined : await createRun({ config, name, projectPath: project, workflowId: workflow.id });
  const runPath = run ? resolve(run) : created!.runPath;
  const manifest = run
    ? workflowId
      ? await updateManifestWorkflow(runPath, workflow.id)
      : await readManifest(runPath)
    : created!.manifest;
  const brief = await scanProject(project);
  await writeJsonFile(join(runPath, manifest.files.brief), brief);
  await updateManifestStatus(runPath, "scanned");
  console.log(`Brief written: ${join(runPath, manifest.files.brief)}`);
}

export async function generateIdeasCommand(run: string, options: { planner?: string; workflow?: string } = {}): Promise<void> {
  const runPath = resolve(run);
  const config = await ensureConfig();
  const planner = parsePlannerMode(options.planner);
  const workflow = options.workflow
    ? resolveWorkflow((await updateManifestWorkflow(runPath, options.workflow)).workflowId)
    : resolveWorkflow((await readManifest(runPath)).workflowId);
  const manifest = await readManifest(runPath);
  const brief = await readJsonFile(join(runPath, manifest.files.brief), projectBriefSchema);
  const appStoreInspiration = await prepareAppStoreInspiration({ runPath, brief, workflow });
  console.log(`Planner: ${planner}`);
  console.log(`Workflow: ${workflow.label}`);
  const { idea, slidesDocument } = await planCampaign(brief, config, planner, workflow, { appStoreInspiration });
  await writeJsonFile(join(runPath, manifest.files.ideas), idea);
  await writeJsonFile(join(runPath, manifest.files.slides), slidesDocument);
  await updateManifestStatus(runPath, "planned");
  console.log(`Ideas written: ${join(runPath, manifest.files.ideas)}`);
  console.log(`Slides written: ${join(runPath, manifest.files.slides)}`);
}

export async function authLoginCommand(provider: string, shouldImport = false): Promise<void> {
  if (provider !== "codex") {
    throw new OpenLoopError(`Unsupported auth provider: ${provider}`, "UNSUPPORTED_PROVIDER");
  }
  const credentials = shouldImport ? await importCodexCliCredentials() : await loginWithCodexDeviceCode();
  console.log(`Codex auth ready: ${credentials.baseUrl}`);
}

export async function authLogoutCommand(provider = "codex"): Promise<void> {
  if (provider !== "codex") {
    throw new OpenLoopError(`Unsupported auth provider: ${provider}`, "UNSUPPORTED_PROVIDER");
  }
  const removed = await clearCodexCredentials();
  console.log(removed ? "Codex auth removed." : "Codex auth was already empty.");
}

export async function generateImagesCommand(run: string, options: { force?: boolean } = {}): Promise<void> {
  await generateImagesForRun(run, { force: options.force });
}

export async function renderCommand(run: string, options: { platform?: string; aspect?: string } = {}): Promise<void> {
  await renderRun(run, options);
}

export async function validateCommand(run: string): Promise<void> {
  await validateRunAndReport(run);
}

export async function showRunCommand(run: string): Promise<void> {
  const manifest = await readManifest(resolve(run));
  console.log(JSON.stringify(manifest, null, 2));
}

export async function runCommand(options: {
  project: string;
  name?: string;
  platform?: string;
  aspect?: string;
  planner?: string;
  workflow?: string;
  screenshots?: string;
}): Promise<void> {
  await runFullPipeline({ ...options, sourceImages: options.screenshots, planner: parsePlannerMode(options.planner) });
}

export async function resumeRunCommand(options: {
  run: string;
  platform?: string;
  aspect?: string;
  forceImages?: boolean;
  workflow?: string;
}): Promise<void> {
  await resumeRunPipeline(options);
}

export function workflowHelp(): string {
  return `workflow: ${workflowOptionList()}`;
}
