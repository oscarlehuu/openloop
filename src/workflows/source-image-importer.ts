import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { OpenLoopError } from "../shared/errors.js";
import { resolveImageStrategy } from "./image-generation-strategies.js";
import { WorkflowDefinition } from "./workflow-definitions.js";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
const APP_AD_SCREENSHOT_LIMIT = 5;

export async function findProjectSourceImageDirectory(
  projectPath: string,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const required = workflow.id === "app-ads" ? 1 : workflow.assetCount;
  const commonDirectories = [
    "screenshots",
    "app-store-screenshots",
    "app-store/screenshots",
    "fastlane/screenshots",
    "metadata"
  ];

  for (const relativePath of commonDirectories) {
    const found = await findImageDirectory(join(projectPath, relativePath), required, 3);
    if (found) return found;
  }
  return undefined;
}

export async function importWorkflowSourceImages(
  sourceDir: string,
  runPath: string,
  workflow: WorkflowDefinition
): Promise<void> {
  const strategy = resolveImageStrategy(workflow);
  if (!strategy.sourceDirectory) return;

  const sourceRoot = resolve(sourceDir);
  const files = await listImageFiles(sourceRoot);
  const required = workflow.id === "app-ads" ? 1 : workflow.assetCount;
  if (files.length < required) {
    throw new OpenLoopError(
      `Expected at least ${required} source screenshot${required === 1 ? "" : "s"}, found ${files.length}.`,
      "SOURCE_SCREENSHOTS_INSUFFICIENT",
      `Add PNG, JPG, or WebP files to ${sourceRoot}.`
    );
  }

  if (workflow.id === "app-ads") {
    await importAppAdScreenshots(sourceRoot, files, runPath, strategy.sourceDirectory);
    return;
  }

  await importPerAssetScreenshots(sourceRoot, files, runPath, strategy.sourceDirectory, workflow.assetCount);
}

async function importAppAdScreenshots(
  sourceRoot: string,
  files: string[],
  runPath: string,
  sourceDirectory: string
): Promise<void> {
  const targetDir = join(runPath, sourceDirectory);
  await mkdir(targetDir, { recursive: true });
  const copiedPaths: string[] = [];

  for (let index = 0; index < Math.min(files.length, APP_AD_SCREENSHOT_LIMIT); index += 1) {
    const sourceFile = files[index];
    const extension = extensionFor(sourceFile);
    const targetPath = join(targetDir, `screenshot-${String(index + 1).padStart(2, "0")}${extension}`);
    await copyFile(join(sourceRoot, sourceFile), targetPath);
    copiedPaths.push(targetPath);
  }

  await writeContactSheet(copiedPaths, join(targetDir, "contact-sheet.png"));
  console.log(`App ad screenshot references copied: ${targetDir}`);
}

async function importPerAssetScreenshots(
  sourceRoot: string,
  files: string[],
  runPath: string,
  sourceDirectory: string,
  assetCount: number
): Promise<void> {
  const targetDir = join(runPath, sourceDirectory);
  await mkdir(targetDir, { recursive: true });
  const sourceFiles = perAssetScreenshotFiles(files, assetCount);
  for (let index = 0; index < assetCount; index += 1) {
    const sourceFile = sourceFiles[index];
    const extension = extensionFor(sourceFile);
    await copyFile(join(sourceRoot, sourceFile), join(targetDir, `slide-${String(index + 1).padStart(2, "0")}${extension}`));
  }
  console.log(`Source screenshots copied: ${targetDir}`);
}

function perAssetScreenshotFiles(files: string[], assetCount: number): string[] {
  const slideFiles = files.filter((file) => /^slide-\d+/i.test(file));
  if (slideFiles.length >= assetCount) return slideFiles.slice(0, assetCount);
  return files.filter((file) => !/contact[-_ ]?sheet/i.test(file)).slice(0, assetCount);
}

async function writeContactSheet(imagePaths: string[], outputPath: string): Promise<void> {
  const width = 1024;
  const height = 1536;
  const columns = Math.min(3, imagePaths.length);
  const rows = Math.ceil(imagePaths.length / columns);
  const cellWidth = Math.floor(width / columns);
  const cellHeight = Math.floor(height / rows);
  const composites = await Promise.all(
    imagePaths.map(async (path, index) => {
      const thumb = await sharp(path)
        .resize({ width: cellWidth - 56, height: cellHeight - 72, fit: "contain", background: "#f7f7f7" })
        .png()
        .toBuffer();
      const metadata = await sharp(thumb).metadata();
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        input: thumb,
        left: Math.round(column * cellWidth + (cellWidth - (metadata.width ?? 0)) / 2),
        top: Math.round(row * cellHeight + (cellHeight - (metadata.height ?? 0)) / 2)
      };
    })
  );

  await sharp({ create: { width, height, channels: 3, background: "#f7f7f7" } })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function listImageFiles(directory: string): Promise<string[]> {
  return (await readdir(directory))
    .filter((file) => IMAGE_EXTENSIONS.test(file))
    .sort((a, b) => a.localeCompare(b));
}

async function findImageDirectory(
  directory: string,
  requiredImages: number,
  depth: number
): Promise<string | undefined> {
  if (depth < 0 || !(await isDirectory(directory))) return undefined;
  if ((await listImageFiles(directory)).length >= requiredImages) return directory;

  for (const entry of await readdir(directory)) {
    if (entry.startsWith(".")) continue;
    const found = await findImageDirectory(join(directory, entry), requiredImages, depth - 1);
    if (found) return found;
  }
  return undefined;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function extensionFor(file: string): string {
  return file.match(IMAGE_EXTENSIONS)?.[0].toLowerCase() ?? ".png";
}
