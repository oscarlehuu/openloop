import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { defaultConfig, ensureConfig } from "../src/config/openloop-config.js";
import { resolveOutputPreset } from "../src/config/output-presets.js";
import { generateCampaignIdea, generateSlides } from "../src/campaign/campaign-generator.js";
import { buildPlannerPrompt, plannerInstructions } from "../src/campaign/codex-planner-prompts.js";
import { extractBeforeClickCatalogFromChunks } from "../src/inspiration/before-click-catalog.js";
import { campaignIdeaSchema } from "../src/campaign/slide-schema.js";
import { codexHeaders } from "../src/providers/codex-oauth/codex-headers.js";
import { writeCaption } from "../src/rendering/caption-exporter.js";
import { writePreviewHtml } from "../src/rendering/preview-exporter.js";
import { renderSlides } from "../src/rendering/slide-renderer.js";
import { renderRun } from "../src/cli/run-pipeline.js";
import { finalSlideRelativePath, outputPresetDir, rawImageRelativePath } from "../src/runs/campaign-layout.js";
import { createRun, readManifest, runManifestSchema } from "../src/runs/run-store.js";
import { scanProject } from "../src/scanner/project-scanner.js";
import { writeJsonFile } from "../src/shared/json-file.js";
import { validateRun } from "../src/validation/run-validator.js";
import { importWorkflowSourceImages } from "../src/workflows/source-image-importer.js";
import { resolveWorkflow } from "../src/workflows/workflow-definitions.js";

describe("OpenLoop core workflow", () => {
  it("creates config and run manifest", async () => {
    const cwd = await tempDir();
    const config = await ensureConfig(cwd);
    const { runPath } = await createRun({ cwd, config, name: "demo launch" });
    const manifest = await readManifest(runPath);
    expect(config.outputDirectory).toBe(".openloop/campaign");
    expect(runPath).toContain(join(".openloop", "campaign", "demo-launch"));
    expect(manifest.runId).toBe("demo-launch");
    expect(manifest.workflowId).toBe("social-carousel");
    expect(manifest.slidesCount).toBe(6);
    expect(manifest.layoutVersion).toBe(2);
    expect(manifest.moduleName).toBe("social-slides");
    expect(manifest.files.brief).toBe("shared/meta/brief.json");
    expect(manifest.files.finalSlidesDir).toBe("modules/social-slides/export/slides");
  });

  it("resolves workflows and preserves legacy manifest compatibility", async () => {
    const cwd = await tempDir();
    const config = defaultConfig();
    const { manifest } = await createRun({ cwd, config, name: "legacy" });
    const legacyManifest = runManifestSchema.parse({ ...manifest, workflowId: undefined });

    expect(resolveWorkflow("app-store-screenshot").assetCount).toBe(5);
    expect(resolveWorkflow("app-ads")).toMatchObject({ assetCount: 12, defaultPlatform: "storyboard-2-3" });
    expect(() => resolveWorkflow("landing-page-image")).toThrow(/Unsupported workflow/);
    expect(legacyManifest.workflowId).toBe("social-carousel");
    expect(() => resolveWorkflow("unknown-workflow")).toThrow(/Unsupported workflow/);
  });

  it("migrates legacy runs output directory and avoids campaign overwrite", async () => {
    const cwd = await tempDir();
    await writeJsonFile(join(cwd, "openloop.config.json"), { ...defaultConfig(), outputDirectory: "runs" });
    const config = await ensureConfig(cwd);
    const first = await createRun({ cwd, config, name: "demo launch" });
    const second = await createRun({ cwd, config, name: "demo launch" });
    expect(config.outputDirectory).toBe(".openloop/campaign");
    expect(first.manifest.runId).toBe("demo-launch");
    expect(second.manifest.runId).toMatch(/^demo-launch-\d{8}-\d{6}/);
  });

  it("scans a project and generates six no-text slide prompts", async () => {
    const projectPath = await fixtureProject();
    const brief = await scanProject(projectPath);
    const idea = generateCampaignIdea(brief);
    const slides = generateSlides(brief, idea);
    expect(brief.projectName).toBe("demo-product");
    expect(slides.slides).toHaveLength(6);
    expect(slides.slides[0].imagePrompt).toContain("9:16");
    expect(slides.slides[0].imagePrompt).toContain("does not need to show the real app UI");
    expect(slides.slides[0].imagePrompt).toContain("No words");
    expect(slides.slides[0].sourceImagePath).toBeUndefined();
    expect(slides.slides[0].overlayText?.headline).toBeTruthy();
  });

  it("keeps social slide and App Store screenshot planner prompts separate", async () => {
    const brief = await scanProject(await fixtureProject());
    const social = resolveWorkflow("social-carousel");
    const appStore = resolveWorkflow("app-store-screenshot");
    const appAds = resolveWorkflow("app-ads");

    expect(plannerInstructions(social)).toContain("9:16 no-text AI-generated scene");
    expect(plannerInstructions(appStore)).toContain("real app screenshots");
    expect(plannerInstructions(appStore)).toContain("before.click inspiration");
    expect(plannerInstructions(appStore)).toContain("background plate");
    expect(plannerInstructions(appAds)).toContain("mobile app ads storyboard planner");
    expect(plannerInstructions(appAds)).toContain("shared/source/app-screenshots/contact-sheet.png");
    expect(plannerInstructions(appAds)).toContain("twelve generated single-shot references");
    expect(plannerInstructions(appAds)).toContain("Do not include real people");
    expect(buildPlannerPrompt(brief, appStore)).toContain("sourceImagePath");
    expect(buildPlannerPrompt(brief, appStore)).toContain("background plate only");
    expect(
      buildPlannerPrompt(brief, appStore, {
        appStoreInspiration: {
          provider: "before.click",
          manifestPath: "modules/app-store-screenshots/references/before-click/manifest.json",
          styleBriefPath: "modules/app-store-screenshots/meta/style-brief.json",
          referenceImagePaths: ["modules/app-store-screenshots/references/before-click/amie/aso-01.webp"],
          plannerContext: "Selected reference: Amie (Productivity; minimal, colorful)."
        }
      })
    ).toContain("App Store inspiration context");
    expect(buildPlannerPrompt(brief, appAds)).toContain("shot-01-roster-pressure");
    expect(buildPlannerPrompt(brief, appAds)).toContain("physical chroma-green tracking card");
    expect(buildPlannerPrompt(brief, appAds)).toContain("scratch-sketch style only");
  });

  it("extracts before.click app metadata from a Next.js chunk", () => {
    const apps = extractBeforeClickCatalogFromChunks([
      String.raw`prefix "apps",0,[{id:"amie",name:"Amie",icon:"/apps/amie/logo.webp",category:"Productivity",designStyles:["minimal","colorful"],description:"The joyful productivity app.",appStoreId:0x5c48d58d,accentColor:"#f472b6",screenshots:["/apps/amie/aso/1.webp"]}] suffix`
    ]);

    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({
      id: "amie",
      name: "Amie",
      category: "Productivity",
      designStyles: ["minimal", "colorful"],
      screenshots: ["/apps/amie/aso/1.webp"]
    });
  });

  it("prioritizes product copy, landing copy, and code signals over setup-only README files", async () => {
    const projectPath = await hospitalityFixtureProject();
    const brief = await scanProject(projectPath);
    expect(brief.summary).toContain("Effortless Staff");
    expect(brief.audience).toContain("restaurant");
    expect(brief.valueProps.join(" ")).toContain("staff rosters");
    expect(brief.sourceFiles).toContain("QuickShift-AppStore-Description.txt");
    expect(brief.sourceFiles).toContain("landing-page.md");
    expect(brief.sourceFiles).toContain("code-signals.txt");
    expect(brief.sourceSnippets.find((item) => item.path === "code-signals.txt")?.content).toContain(
      "Create conflict-free schedules"
    );
    expect(brief.sourceSnippets.find((item) => item.path === "code-signals.txt")?.content).not.toContain(
      "Distracting internal skill text"
    );
  });

  it("renders final slides, caption, preview, and validates the run", async () => {
    const cwd = await tempDir();
    const config = defaultConfig();
    const { runPath } = await createRun({ cwd, config, name: "render smoke" });
    const brief = await scanProject(await fixtureProject());
    const idea = campaignIdeaSchema.parse(generateCampaignIdea(brief));
    const slidesDocument = generateSlides(brief, idea);

    const manifest = await readManifest(runPath);
    await writeJsonFile(join(runPath, manifest.files.brief), brief);
    await writeJsonFile(join(runPath, manifest.files.ideas), idea);
    await writeJsonFile(join(runPath, manifest.files.slides), slidesDocument);
    await writeRawImages(runPath, slidesDocument.slides);
    await writeAppStoreSourceImages(runPath, slidesDocument.slides);

    const outputs = await renderSlides({ runPath, config, slidesDocument });
    await writeCaption({ runPath, idea, slidesDocument, outputPath: manifest.files.caption });
    await writePreviewHtml(runPath, slidesDocument);
    expect(outputs).toHaveLength(6);
    expect((await stat(outputs[0])).size).toBeGreaterThan(1000);
    expect(await readFile(join(runPath, manifest.files.caption), "utf8")).toContain("six-slide");
    expect((await validateRun(runPath)).ok).toBe(true);
  });

  it("renders platform presets at the requested output ratio", async () => {
    const cwd = await tempDir();
    const config = defaultConfig();
    const output = resolveOutputPreset("tiktok");
    const { runPath } = await createRun({ cwd, config, name: "ratio smoke" });
    const brief = await scanProject(await fixtureProject());
    const idea = campaignIdeaSchema.parse(generateCampaignIdea(brief));
    const slidesDocument = generateSlides(brief, idea);

    const manifest = await readManifest(runPath);
    await writeJsonFile(join(runPath, manifest.files.brief), brief);
    await writeJsonFile(join(runPath, manifest.files.ideas), idea);
    await writeJsonFile(join(runPath, manifest.files.slides), slidesDocument);
    await writeRawImages(runPath, slidesDocument.slides);

    const outputs = await renderSlides({ runPath, config, slidesDocument, output });
    const metadata = await sharp(outputs[0]).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
  });

  it("resolves App Store output presets and removes landing preset", () => {
    expect(resolveOutputPreset("app-store-iphone-6-9")).toMatchObject({ width: 1320, height: 2868 });
    expect(resolveOutputPreset("app-store-iphone-6-5")).toMatchObject({ width: 1284, height: 2778 });
    expect(resolveOutputPreset("app-store-ipad-13")).toMatchObject({ width: 2064, height: 2752 });
    expect(resolveOutputPreset("app-store-ipad-12-9")).toMatchObject({ width: 2048, height: 2732 });
    expect(() => resolveOutputPreset("landing-hero")).toThrow(/Unsupported platform/);
  });

  it("imports App Store slide screenshots before helper contact sheets", async () => {
    const cwd = await tempDir();
    const sourceDir = join(cwd, "source");
    const workflow = resolveWorkflow("app-store-screenshot");
    const { runPath } = await createRun({ cwd, config: defaultConfig(), name: "app store import", workflowId: workflow.id });
    await mkdir(sourceDir, { recursive: true });
    await writeSizedImage(join(sourceDir, "contact-sheet.png"), 756, 1020);
    await writeSizedImage(join(sourceDir, "one-check.png"), 200, 200);
    for (let index = 1; index <= workflow.assetCount; index += 1) {
      await writeSizedImage(join(sourceDir, `slide-${String(index).padStart(2, "0")}-screen.png`), 390, 844);
    }

    await importWorkflowSourceImages(sourceDir, runPath, workflow);
    const imported = await sharp(join(runPath, "shared", "source", "app-screenshots", "slide-01.png")).metadata();

    expect(imported.width).toBe(390);
    expect(imported.height).toBe(844);
  });

  it("renders App Store screenshots with overlay and no required caption", async () => {
    const cwd = await tempDir();
    const config = defaultConfig();
    const workflow = resolveWorkflow("app-store-screenshot");
    const { runPath } = await createRun({ cwd, config, name: "app store", workflowId: workflow.id });
    const brief = await scanProject(await fixtureProject());
    const idea = campaignIdeaSchema.parse(generateCampaignIdea(brief));
    const slidesDocument = generateSlides(brief, idea, workflow);

    const manifest = await readManifest(runPath);
    await writeJsonFile(join(runPath, manifest.files.brief), brief);
    await writeJsonFile(join(runPath, manifest.files.ideas), idea);
    await writeJsonFile(join(runPath, manifest.files.slides), slidesDocument);
    await writeRawImages(runPath, slidesDocument.slides);
    await writeAppStoreSourceImages(runPath, slidesDocument.slides);

    await renderRun(runPath);
    const primary = await sharp(join(runPath, finalSlideRelativePath(manifest, 1))).metadata();
    const iphone69 = await sharp(join(runPath, outputPresetDir(manifest, "exports/app-store/iphone-6-9"), "slide-01.png")).metadata();
    const iphone65 = await sharp(join(runPath, outputPresetDir(manifest, "exports/app-store/iphone-6-5"), "slide-01.png")).metadata();
    const ipad13 = await sharp(join(runPath, outputPresetDir(manifest, "exports/app-store/ipad-13"), "slide-01.png")).metadata();
    const ipad129 = await sharp(join(runPath, outputPresetDir(manifest, "exports/app-store/ipad-12-9"), "slide-01.png")).metadata();

    expect(slidesDocument.slides).toHaveLength(5);
    expect(slidesDocument.slides[0].imagePrompt).toContain("background plate");
    expect(slidesDocument.slides[0].imagePrompt).toContain("No phones");
    expect(slidesDocument.slides[0].sourceImagePath).toBe("shared/source/app-screenshots/slide-01.png");
    expect(primary.width).toBe(1320);
    expect(primary.height).toBe(2868);
    expect(iphone69.width).toBe(1320);
    expect(iphone69.height).toBe(2868);
    expect(iphone65.width).toBe(1284);
    expect(iphone65.height).toBe(2778);
    expect(ipad13.width).toBe(2064);
    expect(ipad13.height).toBe(2752);
    expect(ipad129.width).toBe(2048);
    expect(ipad129.height).toBe(2732);
    expect((await validateRun(runPath)).ok).toBe(true);
  });

  it("extracts ChatGPT account id header from JWT", () => {
    const payload = Buffer.from(
      JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acct_123" } })
    ).toString("base64url");
    expect(codexHeaders(`x.${payload}.y`)["ChatGPT-Account-ID"]).toBe("acct_123");
  });
});

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "openloop-"));
}

async function fixtureProject(): Promise<string> {
  const dir = await tempDir();
  await mkdir(join(dir, "docs"), { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo-product", version: "1.0.0" }),
    "utf8"
  );
  await writeFile(
    join(dir, "README.md"),
    "# Demo Product\n\nAI automation for busy software teams that need local campaign assets.",
    "utf8"
  );
  await writeFile(join(dir, "docs", "overview.md"), "Local workflow for developer marketing.", "utf8");
  await writeFile(join(dir, `.${"env"}.local`), "SHOULD_NOT_BE_READ=1", "utf8");
  return dir;
}

async function writeRawImages(runPath: string, slides: Array<{ slideNumber: number }>): Promise<void> {
  const manifest = await readManifest(runPath);
  for (const slide of slides) {
    await sharp({
      create: {
        width: 1024,
        height: 1536,
        channels: 3,
        background: { r: 22, g: 34, b: 48 }
      }
    })
      .png()
      .toFile(join(runPath, rawImageRelativePath(manifest, slide.slideNumber)));
  }
}

async function writeAppStoreSourceImages(
  runPath: string,
  slides: Array<{ slideNumber: number; sourceImagePath?: string }>
): Promise<void> {
  for (const slide of slides) {
    if (!slide.sourceImagePath) continue;
    await mkdir(join(runPath, "shared", "source", "app-screenshots"), { recursive: true });
    await sharp({
      create: {
        width: 390,
        height: 844,
        channels: 3,
        background: { r: 245, g: 250, b: 247 }
      }
    })
      .png()
      .toFile(join(runPath, slide.sourceImagePath));
  }
}

async function writeSizedImage(path: string, width: number, height: number): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 245, g: 250, b: 247 }
    }
  })
    .png()
    .toFile(path);
}

async function hospitalityFixtureProject(): Promise<string> {
  const dir = await tempDir();
  await mkdir(join(dir, "landing"), { recursive: true });
  await mkdir(join(dir, `.${"agents"}`, "skills"), { recursive: true });
  await mkdir(join(dir, "web", "app", "owner"), { recursive: true });
  await writeFile(
    join(dir, "README.md"),
    "# To start project\n\nbe: uv run uvicorn app.main:app --reload --port 8080",
    "utf8"
  );
  await writeFile(
    join(dir, "QuickShift-AppStore-Description.txt"),
    [
      "QuickShift: Effortless Staff & Roster Management",
      "Restaurant and hospitality owners manage staff, schedules, rosters, and payroll."
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(dir, "landing-page.md"),
    "Hero headline: Run shifts in minutes, not spreadsheets.",
    "utf8"
  );
  await writeFile(
    join(dir, "web", "app", "owner", "page.tsx"),
    "export function OwnerRosterPage(){ return 'Create conflict-free schedules and send them instantly to staff.' }",
    "utf8"
  );
  await writeFile(
    join(dir, `.${"agents"}`, "skills", "noisy.ts"),
    "export function DistractingInternalTool(){ return 'Distracting internal skill text about campaigns.' }",
    "utf8"
  );
  await writeFile(join(dir, `.${"env"}.local`), "SECRET_TOKEN=never-read", "utf8");
  return dir;
}
