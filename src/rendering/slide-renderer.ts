import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { SlidesDocument } from "../campaign/slide-schema.js";
import { OpenLoopConfig } from "../config/openloop-config.js";
import { DEFAULT_OUTPUT_PRESET, OutputPreset } from "../config/output-presets.js";
import { campaignLayout, firstExistingPath, idFor, rawImageRelativePath, sourceImagePathForSlide } from "../runs/campaign-layout.js";
import { readManifest, type RunManifest } from "../runs/run-store.js";
import { OpenLoopError } from "../shared/errors.js";
import { resolveWorkflow, WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { buildAppStoreScreenshotComposites } from "./app-store-screenshot-compositor.js";
import { buildOverlaySvg } from "./slide-template.js";

export async function renderSlides(options: {
  runPath: string;
  config: OpenLoopConfig;
  slidesDocument: SlidesDocument;
  output?: OutputPreset;
  outputDir?: string;
  workflow?: WorkflowDefinition;
}): Promise<string[]> {
  const output = options.output ?? DEFAULT_OUTPUT_PRESET;
  const workflow = options.workflow ?? resolveWorkflow();
  const manifest = await readOptionalManifest(options.runPath);
  const outputDir = join(options.runPath, options.outputDir ?? manifest?.files.finalSlidesDir ?? campaignLayout(workflow).moduleFinalSlidesDir);
  await mkdir(outputDir, { recursive: true });
  const outputs: string[] = [];

  for (const slide of options.slidesDocument.slides) {
    const id = idFor(slide.slideNumber);
    const rawPath = await resolveRawImagePath(options.runPath, workflow, manifest, slide.slideNumber);
    const outputPath = join(outputDir, `slide-${id}.png`);
    const image = await buildBaseImage(options.runPath, workflow, rawPath, slide, output);
    const rendered =
      workflow.overlayMode === "render"
        ? image.composite([
            {
              input: buildOverlaySvg(slide, options.config.theme, output, {
                compactTopLayout: workflow.id === "app-store-screenshot"
              }),
              top: 0,
              left: 0
            }
          ])
        : image;
    await rendered.png().toFile(outputPath);
    outputs.push(outputPath);
  }

  return outputs;
}

async function buildBaseImage(
  runPath: string,
  workflow: WorkflowDefinition,
  rawPath: string,
  slide: SlidesDocument["slides"][number],
  output: OutputPreset
): Promise<sharp.Sharp> {
  const background = sharp(rawPath).resize(output.width, output.height, { fit: "cover" });
  if (workflow.id !== "app-store-screenshot") return background;
  const sourcePath = await resolveAppStoreSourceImagePath(runPath, workflow, slide);
  const base = await background.composite(await buildAppStoreScreenshotComposites(sourcePath, output)).png().toBuffer();
  return sharp(base);
}

async function resolveRawImagePath(
  runPath: string,
  workflow: WorkflowDefinition,
  manifest: RunManifest | undefined,
  slideNumber: number
): Promise<string> {
  const id = idFor(slideNumber);
  const candidates = [
    manifest ? join(runPath, rawImageRelativePath(manifest, slideNumber)) : undefined,
    join(runPath, campaignLayout(workflow).moduleRawImagesDir, `slide-${id}.png`),
    join(runPath, "images", `slide-${id}-raw.png`)
  ].filter((path): path is string => Boolean(path));
  return (await firstExistingPath(candidates)) ?? candidates[0];
}

async function readOptionalManifest(runPath: string): Promise<RunManifest | undefined> {
  try {
    return await readManifest(runPath);
  } catch {
    return undefined;
  }
}

async function resolveAppStoreSourceImagePath(
  runPath: string,
  workflow: WorkflowDefinition,
  slide: { slideNumber: number; sourceImagePath?: string }
): Promise<string> {
  const candidates = [
    slide.sourceImagePath ? resolve(runPath, slide.sourceImagePath) : undefined,
    sourceImagePathForSlide(slide.slideNumber, workflow)
      ? join(runPath, sourceImagePathForSlide(slide.slideNumber, workflow)!)
      : undefined
  ].filter((path): path is string => Boolean(path));
  const sourcePath = await firstExistingPath(candidates);
  if (sourcePath) return sourcePath;
  throw new OpenLoopError(
    `App Store slide ${idFor(slide.slideNumber)} needs a real source screenshot for deterministic composition.`,
    "SOURCE_SCREENSHOT_REQUIRED",
    `Add ${candidates[0] ?? "shared/source/app-screenshots/slide-XX.png"} and rerun openloop render.`
  );
}
