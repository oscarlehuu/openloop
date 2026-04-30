import { join, resolve } from "node:path";
import { campaignIdeaSchema, slidesDocumentSchema } from "../campaign/slide-schema.js";
import { planCampaign, PlannerMode } from "../campaign/campaign-planner.js";
import { ensureConfig, readConfig } from "../config/openloop-config.js";
import { prepareAppStoreInspiration } from "../inspiration/app-store-inspiration.js";
import { OutputPreset, resolveOutputPreset } from "../config/output-presets.js";
import { writeCaption } from "../rendering/caption-exporter.js";
import { APP_ADS_VIDEO_REFERENCE_DIR, renderAppAdsVideoReferences } from "../rendering/app-ads-video-reference-assets.js";
import { writePreviewHtml } from "../rendering/preview-exporter.js";
import { renderSlides } from "../rendering/slide-renderer.js";
import { writeVideoPrompts } from "../rendering/video-prompt-exporter.js";
import { outputPresetDir } from "../runs/campaign-layout.js";
import { createRun, readManifest, updateManifestStatus, updateManifestWorkflow } from "../runs/run-store.js";
import { projectBriefSchema, scanProject } from "../scanner/project-scanner.js";
import { OpenLoopError } from "../shared/errors.js";
import { readJsonFile, writeJsonFile } from "../shared/json-file.js";
import { validateRun } from "../validation/run-validator.js";
import { resolveImageStrategy } from "../workflows/image-generation-strategies.js";
import { findProjectSourceImageDirectory, importWorkflowSourceImages } from "../workflows/source-image-importer.js";
import { resolveWorkflow, WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { generateImagesForRun } from "./image-generation-runner.js";

export async function renderRun(
  run: string,
  options: { platform?: string; aspect?: string; output?: OutputPreset; workflow?: WorkflowDefinition } = {}
): Promise<void> {
  const runPath = resolve(run);
  const config = await readConfig();
  const manifest = options.workflow ? await updateManifestWorkflow(runPath, options.workflow.id) : await readManifest(runPath);
  const workflow = options.workflow ?? resolveWorkflow(manifest.workflowId);
  const output = options.output ?? resolveOutputPreset(options.platform, options.aspect, workflow.defaultPlatform);
  const slidesDocument = await readJsonFile(join(runPath, manifest.files.slides), slidesDocumentSchema);
  assertWorkflowAssetCount(slidesDocument, workflow, runPath);
  await renderSlides({ runPath, config, slidesDocument, output, outputDir: manifest.files.finalSlidesDir, workflow });
  for (const target of workflowOutputPresets(workflow)) {
    if (!target.exportDir) continue;
    await renderSlides({ runPath, config, slidesDocument, output: target, outputDir: outputPresetDir(manifest, target.exportDir), workflow });
  }
  if (workflow.id === "app-ads") {
    await renderAppAdsVideoReferences(runPath, slidesDocument);
  }
  if (workflow.requiresCaption) {
    const idea = await readJsonFile(join(runPath, manifest.files.ideas), campaignIdeaSchema);
    await writeCaption({ runPath, idea, slidesDocument, outputPath: manifest.files.caption });
  }
  await writePreviewHtml(runPath, slidesDocument, {
    outputPath: manifest.files.preview,
    imageBasePath: manifest.layoutVersion >= 2 ? "../export/slides" : "./slides"
  });
  const videoPrompts = await writeVideoPrompts({ runPath, slidesDocument, workflow });
  await updateManifestStatus(runPath, "rendered");
  console.log(`Final slides written: ${join(runPath, manifest.files.finalSlidesDir)}`);
  if (videoPrompts.length) {
    const perImagePromptDir =
      workflow.id === "app-ads" ? join(runPath, APP_ADS_VIDEO_REFERENCE_DIR) : join(runPath, manifest.files.finalSlidesDir);
    console.log(`Video prompts written: ${join(videoPrompts[0], "..")} and ${perImagePromptDir}`);
  }
  console.log(`Workflow: ${workflow.label}`);
  console.log(`Output: ${output.label} ${output.aspect} ${output.width}x${output.height}`);
  const targetLabels = workflowOutputPresets(workflow)
    .filter((target) => target.exportDir)
    .map((target) => `${target.label} ${target.width}x${target.height}`);
  if (targetLabels.length) console.log(`Targets: ${targetLabels.join(", ")}`);
}

export async function validateRunAndReport(run: string): Promise<boolean> {
  const result = await validateRun(resolve(run));
  for (const error of result.errors) console.error(`error: ${error}`);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (!result.ok) process.exitCode = 1;
  else console.log(result.warnings.length ? "Run valid with warnings." : "Run valid.");
  return result.ok;
}

export async function runFullPipeline(options: {
  project: string;
  name?: string;
  platform?: string;
  aspect?: string;
  planner: PlannerMode;
  workflow?: string;
  sourceImages?: string;
}): Promise<void> {
  const workflow = resolveWorkflow(options.workflow);
  const output = resolveOutputPreset(options.platform, options.aspect, workflow.defaultPlatform);
  const config = await ensureConfig();
  const projectPath = resolve(options.project);
  const { runPath, manifest } = await createRun({ config, name: options.name ?? "campaign", projectPath, workflowId: workflow.id });
  console.log(`Run created: ${runPath}`);
  console.log(`Workflow: ${workflow.label}`);
  console.log(`Output: ${output.label} ${output.aspect} ${output.width}x${output.height}`);

  const brief = await scanProject(projectPath);
  await writeJsonFile(join(runPath, manifest.files.brief), brief);
  await updateManifestStatus(runPath, "scanned");
  console.log(`Brief written: ${join(runPath, manifest.files.brief)}`);

  const appStoreInspiration = await prepareAppStoreInspiration({ runPath, brief, workflow });

  console.log(`Planner: ${options.planner}`);
  const { idea, slidesDocument } = await planCampaign(brief, config, options.planner, workflow, { appStoreInspiration });
  await writeJsonFile(join(runPath, manifest.files.ideas), idea);
  await writeJsonFile(join(runPath, manifest.files.slides), slidesDocument);
  await updateManifestStatus(runPath, "planned");
  console.log(`Ideas written: ${join(runPath, manifest.files.ideas)}`);
  console.log(`Slides written: ${join(runPath, manifest.files.slides)}`);

  const imageStrategy = resolveImageStrategy(workflow);
  if (imageStrategy.requiresSourceImage) {
    const sourceImages = options.sourceImages ?? (await findProjectSourceImageDirectory(projectPath, workflow));
    if (sourceImages) {
      await importWorkflowSourceImages(sourceImages, runPath, workflow);
    } else {
      console.log(`Plan ready: ${runPath}`);
      console.log(`Add real screenshots to ${join(runPath, imageStrategy.sourceDirectory ?? "shared/source/app-screenshots")}`);
      console.log(`Then run: openloop run:resume --run ${runPath}`);
      return;
    }
  }

  await generateImagesForRun(runPath);
  await renderRun(runPath, { output, workflow });
  if (await validateRunAndReport(runPath)) {
    console.log(`Run complete: ${runPath}`);
    console.log(`Preview: ${join(runPath, manifest.files.preview)}`);
  }
}

export async function resumeRunPipeline(options: {
  run: string;
  platform?: string;
  aspect?: string;
  forceImages?: boolean;
  workflow?: string;
}): Promise<void> {
  const runPath = resolve(options.run);
  const workflow = await workflowForRun(runPath, options.workflow);
  const output = resolveOutputPreset(options.platform, options.aspect, workflow.defaultPlatform);
  await ensureRunHasPlan(runPath, workflow);
  await generateImagesForRun(runPath, { force: options.forceImages });
  await renderRun(runPath, { output, workflow });
  if (await validateRunAndReport(runPath)) {
    const manifest = await readManifest(runPath);
    console.log(`Run complete: ${runPath}`);
    console.log(`Preview: ${join(runPath, manifest.files.preview)}`);
  }
}

async function ensureRunHasPlan(runPath: string, workflow?: WorkflowDefinition): Promise<void> {
  const manifest = await readManifest(runPath);
  const brief = await readJsonFile(join(runPath, manifest.files.brief), projectBriefSchema);
  await readJsonFile(join(runPath, manifest.files.ideas), campaignIdeaSchema);
  const slidesDocument = await readJsonFile(join(runPath, manifest.files.slides), slidesDocumentSchema);
  if (workflow) assertWorkflowAssetCount(slidesDocument, workflow, runPath);
  if (workflow?.id === "app-store-screenshot") await prepareAppStoreInspiration({ runPath, brief, workflow });
}

async function workflowForRun(runPath: string, override?: string): Promise<WorkflowDefinition> {
  if (override) return resolveWorkflow((await updateManifestWorkflow(runPath, override)).workflowId);
  return resolveWorkflow((await readManifest(runPath)).workflowId);
}

function assertWorkflowAssetCount(
  slidesDocument: { slides: unknown[] },
  workflow: WorkflowDefinition,
  runPath: string
): void {
  if (slidesDocument.slides.length === workflow.assetCount) return;
  throw new OpenLoopError(
    `Run plan has ${slidesDocument.slides.length} assets, but ${workflow.label} expects ${workflow.assetCount}.`,
    "WORKFLOW_PLAN_MISMATCH",
    `Regenerate ideas with: openloop generate:ideas --run ${runPath} --workflow ${workflow.id}`
  );
}

function workflowOutputPresets(workflow: WorkflowDefinition): OutputPreset[] {
  return workflow.outputPlatforms.map((platform) => resolveOutputPreset(platform));
}
