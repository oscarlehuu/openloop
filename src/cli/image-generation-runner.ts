import { access, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { slidesDocumentSchema } from "../campaign/slide-schema.js";
import { readConfig } from "../config/openloop-config.js";
import { appStoreInspirationReferenceImages } from "../inspiration/app-store-inspiration.js";
import { CodexOAuthImageProvider } from "../providers/codex-oauth/codex-image-client.js";
import { rawImageRelativePath } from "../runs/campaign-layout.js";
import { readManifest, updateManifestStatus } from "../runs/run-store.js";
import { OpenLoopError, toErrorMessage } from "../shared/errors.js";
import { readJsonFile } from "../shared/json-file.js";
import { buildProviderPrompt, resolveImageStrategy } from "../workflows/image-generation-strategies.js";
import { resolveWorkflow, WorkflowDefinition } from "../workflows/workflow-definitions.js";

const DEFAULT_IMAGE_RETRIES = 2;

export async function generateImagesForRun(
  run: string,
  options: { force?: boolean; retries?: number } = {}
): Promise<void> {
  const runPath = resolve(run);
  const config = await readConfig();
  const manifest = await readManifest(runPath);
  const workflow = resolveWorkflow(manifest.workflowId);
  const imageStrategy = resolveImageStrategy(workflow);
  const slides = await readJsonFile(join(runPath, manifest.files.slides), slidesDocumentSchema);
  const provider = new CodexOAuthImageProvider(config);
  const referenceImagePaths =
    workflow.id === "app-store-screenshot" ? [] : await appStoreInspirationReferenceImages(runPath, workflow);

  for (const slide of slides.slides) {
    const id = String(slide.slideNumber).padStart(2, "0");
    const outputPath = join(runPath, rawImageRelativePath(manifest, slide.slideNumber));
    await mkdir(dirname(outputPath), { recursive: true });
    if (!options.force && (await fileExistsWithContent(outputPath))) {
      console.log(`Image ${id} exists, skipping.`);
      continue;
    }
    console.log(`Generating image ${id}...`);
    const sourceImagePath = imageStrategy.requiresSourceImage
      ? await resolveSourceImagePath(runPath, slide, workflow)
      : undefined;
    const providerSourceImagePath = workflow.id === "app-store-screenshot" || workflow.id === "app-ads"
      ? undefined
      : sourceImagePath;
    await generateImageWithRetry(
      () =>
        provider.generateImage({
          slide,
          outputPath,
          prompt: buildProviderPrompt(slide, workflow),
          instructions: imageStrategy.providerInstructions,
          sourceImagePath: providerSourceImagePath,
          referenceImagePaths,
          size: imageStrategy.imageSize ?? config.image.size,
          quality: config.image.quality
        }),
      { slideId: id, retries: options.retries ?? DEFAULT_IMAGE_RETRIES, runPath }
    );
  }
  await updateManifestStatus(runPath, "imaged");
  console.log(`Raw images written: ${join(runPath, manifest.files.imagesDir)}`);
}

async function resolveSourceImagePath(
  runPath: string,
  slide: { slideNumber: number; sourceImagePath?: string },
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const strategy = resolveImageStrategy(workflow);
  if (!strategy.requiresSourceImage) return undefined;

  for (const candidate of sourceImageCandidates(runPath, slide, strategy.sourceDirectory, strategy.sharedSourceImagePath)) {
    if (await fileExistsWithContent(candidate)) return candidate;
  }

  const defaultPath = strategy.sharedSourceImagePath
    ? join(runPath, strategy.sharedSourceImagePath)
    : strategy.sourceDirectory
    ? join(runPath, strategy.sourceDirectory, `slide-${String(slide.slideNumber).padStart(2, "0")}.png`)
    : join(runPath, `slide-${String(slide.slideNumber).padStart(2, "0")}.png`);
  throw new OpenLoopError(
    `Image ${String(slide.slideNumber).padStart(2, "0")} needs a real app screenshot source.`,
    "SOURCE_SCREENSHOT_REQUIRED",
    `Add ${defaultPath} or set sourceImagePath in slides.json.`
  );
}

function sourceImageCandidates(
  runPath: string,
  slide: { slideNumber: number; sourceImagePath?: string },
  sourceDirectory?: string,
  sharedSourceImagePath?: string
): string[] {
  const id = String(slide.slideNumber).padStart(2, "0");
  const candidates: string[] = [];
  if (slide.sourceImagePath) candidates.push(resolve(runPath, slide.sourceImagePath));
  if (sharedSourceImagePath) candidates.push(resolve(runPath, sharedSourceImagePath));
  if (sourceDirectory) {
    const base = join(runPath, sourceDirectory, `slide-${id}`);
    candidates.push(`${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.webp`);
    candidates.push(join(runPath, "screenshots", `slide-${id}.png`));
  }
  if (sharedSourceImagePath) candidates.push(join(runPath, "references", "app-screenshots", "contact-sheet.png"));
  return [...new Set(candidates)];
}

async function generateImageWithRetry(
  action: () => Promise<void>,
  options: { slideId: string; retries: number; runPath: string }
): Promise<void> {
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      await action();
      return;
    } catch (error) {
      if (attempt >= options.retries || !isRetryableImageError(error)) {
        throw new OpenLoopError(
          `Image ${options.slideId} failed: ${toErrorMessage(error)}`,
          "IMAGE_GENERATION_FAILED",
          `Retry this run with: openloop run:resume --run ${options.runPath}`
        );
      }
      const waitMs = 2000 * (attempt + 1);
      console.warn(`Image ${options.slideId} failed, retrying in ${Math.round(waitMs / 1000)}s: ${toErrorMessage(error)}`);
      await delay(waitMs);
    }
  }
}

function isRetryableImageError(error: unknown): boolean {
  if (!(error instanceof OpenLoopError)) return true;
  return !["CODEX_AUTH_MISSING", "CODEX_IMPORT_FAILED", "UNSUPPORTED_PROVIDER"].includes(error.code);
}

async function fileExistsWithContent(path: string): Promise<boolean> {
  try {
    await access(path);
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
