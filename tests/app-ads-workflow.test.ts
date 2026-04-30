import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateCampaignIdea, generateSlides } from "../src/campaign/campaign-generator.js";
import { campaignIdeaSchema } from "../src/campaign/slide-schema.js";
import { renderRun } from "../src/cli/run-pipeline.js";
import { defaultConfig } from "../src/config/openloop-config.js";
import { rawImageRelativePath } from "../src/runs/campaign-layout.js";
import { createRun, readManifest } from "../src/runs/run-store.js";
import { scanProject } from "../src/scanner/project-scanner.js";
import { writeJsonFile } from "../src/shared/json-file.js";
import { validateRun } from "../src/validation/run-validator.js";
import { buildAppAdsVideoReferencePrompt } from "../src/rendering/app-ads-video-reference-assets.js";
import { importWorkflowSourceImages } from "../src/workflows/source-image-importer.js";
import { resolveWorkflow } from "../src/workflows/workflow-definitions.js";

describe("app ads workflow", () => {
  it("imports app screenshots into a contact sheet", async () => {
    const cwd = await tempDir();
    const sourceDir = join(cwd, "source-screenshots");
    await mkdir(sourceDir, { recursive: true });
    await writeFixtureImage(join(sourceDir, "home.png"), { r: 30, g: 80, b: 160 });
    await writeFixtureImage(join(sourceDir, "result.png"), { r: 40, g: 160, b: 110 });
    const workflow = resolveWorkflow("app-ads");
    const { runPath } = await createRun({ cwd, config: defaultConfig(), name: "app ads", workflowId: workflow.id });

    await importWorkflowSourceImages(sourceDir, runPath, workflow);
    const contactSheet = await sharp(join(runPath, "shared", "source", "app-screenshots", "contact-sheet.png")).metadata();

    expect(contactSheet.width).toBe(1024);
    expect(contactSheet.height).toBe(1536);
  });

  it("renders single-shot green-screen references and writes video prompts", async () => {
    const cwd = await tempDir();
    const workflow = resolveWorkflow("app-ads");
    const { runPath } = await createRun({ cwd, config: defaultConfig(), name: "app ads", workflowId: workflow.id });
    const brief = await scanProject(await fixtureProject());
    const idea = campaignIdeaSchema.parse(generateCampaignIdea(brief, workflow));
    const slidesDocument = generateSlides(brief, idea, workflow);

    const manifest = await readManifest(runPath);
    await writeJsonFile(join(runPath, manifest.files.brief), brief);
    await writeJsonFile(join(runPath, manifest.files.ideas), idea);
    await writeJsonFile(join(runPath, manifest.files.slides), slidesDocument);
    await writeRawImages(runPath, slidesDocument.slides);

    await renderRun(runPath);
    const storyboard = await sharp(join(runPath, "modules", "app-ads", "export", "slides", "slide-01.png")).metadata();
    const klingPrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-prompts", "kling.md"), "utf8");
    const seedancePrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-prompts", "seedance.md"), "utf8");
    const modelAgentPrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-prompts", "model-agent.md"), "utf8");
    const cleanReference = await sharp(join(runPath, "modules", "app-ads", "export", "video-references", "images", "slide-01.png")).metadata();
    const slide01SeedancePrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-references", "prompts", "slide-01-seedance.md"), "utf8");
    const slide01KlingPrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-references", "prompts", "slide-01-kling.md"), "utf8");
    const slide01AgentPrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-references", "prompts", "slide-01-agent.md"), "utf8");
    const slide12SeedancePrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-references", "prompts", "slide-12-seedance.md"), "utf8");
    const slide12KlingPrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-references", "prompts", "slide-12-kling.md"), "utf8");
    const slide12AgentPrompt = await readFile(join(runPath, "modules", "app-ads", "export", "video-references", "prompts", "slide-12-agent.md"), "utf8");

    expect(slidesDocument.slides).toHaveLength(12);
    expect(slidesDocument.slides[0].role).toBe("shot-01-roster-pressure");
    expect(slidesDocument.slides[11].role).toBe("shot-12-final-outcome");
    expect(slidesDocument.slides[0].overlayText).toBeUndefined();
    expect(slidesDocument.slides[0].sourceImagePath).toBe("shared/source/app-screenshots/contact-sheet.png");
    expect(slidesDocument.slides[0].imagePrompt).toContain("one shot only");
    expect(slidesDocument.slides[0].imagePrompt).toContain("chroma-green physical tracking card");
    expect(slidesDocument.slides[0].imagePrompt).toContain("[PANEL SEQUENCE]");
    expect(buildAppAdsVideoReferencePrompt(slidesDocument, slidesDocument.slides[0])).toContain(
      "flat matte chroma-green physical tracking card"
    );
    expect(buildAppAdsVideoReferencePrompt(slidesDocument, slidesDocument.slides[0])).not.toMatch(
      /contact sheet|preserve the supplied screenshots/i
    );
    expect(storyboard.width).toBe(1024);
    expect(storyboard.height).toBe(1536);
    expect(cleanReference.width).toBe(1024);
    expect(cleanReference.height).toBe(1536);
    expect(klingPrompt).toContain("Kling App Ad Prompt");
    expect(seedancePrompt).toContain("Seedance 2.0 App Ad Prompt");
    expect(seedancePrompt).toContain("modules/app-ads/export/video-references/images/slide-01.png");
    expect(seedancePrompt).toContain("Do not upload all 12 references at once");
    expect(seedancePrompt).not.toContain("storyboard-sheet: exports/slides/slide-01.png");
    expect(modelAgentPrompt).toContain("App Ads Model Agent Prompt");
    expect(modelAgentPrompt).toContain("Attach one image from modules/app-ads/export/video-references/images/ at a time");
    expect(modelAgentPrompt).toContain("2-4 second vertical 9:16 plate");
    expect(seedancePrompt).toContain("physical matte chroma-green tracking card");
    expect(seedancePrompt).toContain("live-action-looking footage");
    expect(slide01SeedancePrompt).toContain("single-shot reference");
    expect(slide01SeedancePrompt).toContain("modules/app-ads/export/video-references/images/slide-01.png");
    expect(slide01SeedancePrompt).not.toContain("Primary reference image: modules/app-ads/export/slides/slide-01.png");
    expect(slide01SeedancePrompt).toContain("2-4 seconds");
    expect(slide01SeedancePrompt).toContain("chroma-green physical tracking card");
    expect(slide01KlingPrompt).toContain("single image reference");
    expect(slide01AgentPrompt).toContain("Before generation");
    expect(slide12SeedancePrompt).toContain("shot-12-final-outcome");
    expect(slide12SeedancePrompt).toContain("No phone operating system");
    expect(slide01SeedancePrompt).not.toMatch(
      /planeshot|arblank plane|real UI|actual screenshot|sourced from screenshot|contact-sheet crop|taped screenshot|authentic .*screen|real notification|real attendance|QuickShift screenshot contact sheet|traced real QuickShift|shift block|Entire sheet visible/i
    );
    expect(slide12SeedancePrompt).not.toMatch(
      /planeshot|arblank plane|real UI|actual screenshot|sourced from screenshot|contact-sheet crop|taped screenshot|authentic .*screen|real notification|real attendance|QuickShift screenshot contact sheet|traced real QuickShift|shift block|next-step control|visible approve|Entire sheet visible|no realistic lifestyle scene/i
    );
    expect(slide12KlingPrompt).toContain("Negative prompt");
    expect(slide12AgentPrompt).toContain("Attach these files");
    expect((await validateRun(runPath)).ok).toBe(true);
  });
});

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "openloop-app-ads-"));
}

async function fixtureProject(): Promise<string> {
  const dir = await tempDir();
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "demo-product", version: "1.0.0" }), "utf8");
  await writeFile(join(dir, "README.md"), "# Demo Product\n\nAI automation for busy teams.", "utf8");
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

async function writeFixtureImage(path: string, color: { r: number; g: number; b: number }): Promise<void> {
  await sharp({
    create: {
      width: 390,
      height: 844,
      channels: 3,
      background: color
    }
  })
    .png()
    .toFile(path);
}
