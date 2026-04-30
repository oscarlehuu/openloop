import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SlidesDocument, type Slide } from "../campaign/slide-schema.js";
import { WorkflowDefinition } from "../workflows/workflow-definitions.js";
import {
  APP_ADS_VIDEO_REFERENCE_PROMPT_DIR,
  appAdsVideoReferencePromptPath,
  appAdsVideoReferenceRelativePath
} from "./app-ads-video-reference-assets.js";
import {
  formatList,
  panelReference,
  type SlidePromptContext
} from "./app-ads-video-prompt-content.js";

interface PerImagePromptOptions {
  runPath: string;
  slidesDocument: SlidesDocument;
  workflow: WorkflowDefinition;
}

export async function writePerImageModelPrompts(options: PerImagePromptOptions): Promise<string[]> {
  if (options.workflow.id !== "app-ads") return [];

  const outputDir = join(options.runPath, APP_ADS_VIDEO_REFERENCE_PROMPT_DIR);
  await mkdir(outputDir, { recursive: true });

  const paths: string[] = [];
  for (const slide of options.slidesDocument.slides) {
    const context = buildContext(options.slidesDocument, slide);
    const seedancePath = appAdsVideoReferencePromptPath(options.runPath, slide.slideNumber, "seedance");
    const klingPath = appAdsVideoReferencePromptPath(options.runPath, slide.slideNumber, "kling");
    const agentPath = appAdsVideoReferencePromptPath(options.runPath, slide.slideNumber, "agent");

    await writeFile(seedancePath, buildSeedancePerImagePrompt(context), "utf8");
    await writeFile(klingPath, buildKlingPerImagePrompt(context), "utf8");
    await writeFile(agentPath, buildAgentPerImagePrompt(context), "utf8");
    paths.push(seedancePath, klingPath, agentPath);
  }
  return paths;
}

function buildContext(slidesDocument: SlidesDocument, slide: Slide): SlidePromptContext {
  const brief = slidesDocument.brief;
  return {
    slide,
    imagePath: appAdsVideoReferenceRelativePath(slide.slideNumber),
    contactSheetPath: "shared/source/app-screenshots/contact-sheet.png",
    projectName: brief.projectName,
    audience: brief.audience,
    summary: brief.summary,
    valueProps: brief.valueProps
  };
}

function buildSeedancePerImagePrompt(context: SlidePromptContext): string {
  return [
    `# Seedance 2.0 Prompt - ${context.imagePath}`,
    "",
    "## Assets to attach",
    `1. Primary reference image: ${context.imagePath}`,
    "2. Do not attach any other shot reference images in this run.",
    `3. Do not attach ${context.contactSheetPath} to Seedance as a visual reference. Use it later for post-production screen overlay only.`,
    "",
    "## Generation target",
    `Shot role: ${context.slide.role}.`,
    "Create one short vertical 9:16 live-action plate from this single-shot reference.",
    "Length: 2-4 seconds. Generate this shot alone; do not combine multiple workflow steps.",
    "The final footage should look filmed, not illustrated. Do not render paper texture, drawing lines, arrows, frame numbers, captions, or storyboard style.",
    "",
    "## How to use the primary image",
    "Use the primary image only for camera framing, hand-phone pose, hospitality setting, and rough motion. Convert it into realistic footage.",
    "",
    "## Shot reference from this image",
    panelReference(context),
    "",
    "## Scene direction",
    "- Restaurant or cafe environment only: service counter, POS terminal, order slips, apron/staff cue, warm practical hospitality lighting.",
    "- Avoid office desk, computer monitor, keyboard, mouse, corporate desk setup, bedroom, living room, or generic tech-review table.",
    "- Natural handheld camera with stable phone geometry and a screen plane that can be tracked.",
    "- Keep hands anatomically correct. Keep fingers outside the green rectangle as much as possible.",
    "",
    "## Phone screen rule",
    "- The entire phone display area is covered by a flat matte chroma-green physical tracking card or sticker.",
    "- It is not a powered-on display.",
    "- No phone operating system. No app interface. No icons. No settings screen. No control center. No text. No buttons. No UI. No fake app screen.",
    `- After video generation, composite exact source screenshots from ${context.contactSheetPath} onto the green screen plane.`,
    "",
    "## Locked requirements",
    "- If Seedance generates any UI, app screen, iOS settings, control center, icons, text, or buttons, reject and regenerate.",
    "- Do not output a video of the reference image itself.",
    "- No subtitles, no added text overlays, no watermark, no app-store badges, no fake review stars."
  ].join("\n");
}

function buildKlingPerImagePrompt(context: SlidePromptContext): string {
  return [
    `# Kling Prompt - ${context.imagePath}`,
    "",
    "## Input images",
    `Primary single-shot image-to-video reference: ${context.imagePath}`,
    `Do not use ${context.contactSheetPath} as a video-model UI reference. Use it only for post-production screen overlay.`,
    "",
    "## Prompt",
    "Generate a 2-4 second vertical 9:16 live-action plate from this single image reference.",
    "Use a restaurant/cafe hospitality environment, not an office. Keep one phone, one hand action, and one stable green screen plane.",
    "",
    "Specific shot reference from the primary image:",
    panelReference(context),
    "",
    "Visual direction:",
    "- Convert sketch reference to filmed footage. Do not keep pencil style, paper texture, arrows, labels, or panel numbers.",
    "- Phone screen must be a physical matte chroma-green card/sticker, not a powered-on display.",
    "- Keep the green rectangle visible and trackable. Keep fingers outside it as much as possible.",
    "- Close phone interaction should feel tactile: short tap, swipe, pickup, or hold.",
    "",
    "Negative prompt:",
    "office desk, computer monitor, keyboard, mouse, powered-on phone display, phone operating system, app interface, iOS settings, control center, icons, buttons, UI text, labels, translated words, fake interface, charts, cards, rows, subtitles, watermark, extra logos, distorted hands, duplicated fingers, melted device edges, floating UI overlays"
  ].join("\n");
}

function buildAgentPerImagePrompt(context: SlidePromptContext): string {
  return [
    `# Model Agent Instructions - ${context.imagePath}`,
    "",
    "You are operating a video generation model for the OpenLoop app-ads workflow.",
    "",
    "## Attach these files",
    `- Primary image: ${context.imagePath}`,
    "- Do not attach other shot references to this generation.",
    `- Do not attach app screenshot/contact sheet to Seedance for UI generation: ${context.contactSheetPath}`,
    "",
    "## Before generation",
    "1. Inspect the primary image as one shot reference only.",
    "2. Confirm it is scratch/non-photoreal and contains no real or identifiable person.",
    "3. Generate a 2-4 second live-action plate. Do not ask the model to animate a sheet or combine shots.",
    "4. Ask Seedance for a physical chroma-green tracking card over the phone display. If generated video redraws UI/text, reject it.",
    "5. Composite the exact app screenshots from the contact sheet after generation.",
    "6. Repeat this per shot, then edit clips together outside Seedance.",
    "",
    "## Scene intent",
    `Product: ${context.projectName}.`,
    `Audience: ${context.audience}.`,
    `Context: ${context.summary}`,
    `Value props to preserve: ${formatList(context.valueProps)}.`,
    "",
    "## Required prompt structure for the model",
    "Single-shot live-action plate, restaurant/cafe environment, phone held vertically, chroma-green screen card, no app UI.",
    "",
    "Specific shot reference to preserve:",
    panelReference(context),
    "",
    "## Review checklist",
    "- The output is one short live-action-looking vertical plate, not a moving storyboard board.",
    "- The attached primary reference is a scratch single-shot reference with no real or photoreal person.",
    "- Phone screen is a chroma-green tracking card; no generated UI text appears.",
    "- Exact mobile UI is preserved only through post-production overlay from source screenshots.",
    "- Phone, fingers, wrists, and screen perspective stay stable.",
    "- The motion follows the selected image's single action.",
    "- No captions, no watermarks, no fake review text, no invented app feature claims."
  ].join("\n");
}
