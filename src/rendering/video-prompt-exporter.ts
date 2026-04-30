import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SlidesDocument } from "../campaign/slide-schema.js";
import { WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { appAdsVideoReferenceRelativePath } from "./app-ads-video-reference-assets.js";
import { writePerImageModelPrompts } from "./app-ads-per-image-prompt-exporter.js";

const APP_ADS_VIDEO_PROMPT_DIR = "modules/app-ads/export/video-prompts";
const APP_ADS_SOURCE_CONTACT_SHEET = "shared/source/app-screenshots/contact-sheet.png";

export async function writeVideoPrompts(options: {
  runPath: string;
  slidesDocument: SlidesDocument;
  workflow: WorkflowDefinition;
}): Promise<string[]> {
  if (options.workflow.id !== "app-ads") return [];

  const outputDir = join(options.runPath, APP_ADS_VIDEO_PROMPT_DIR);
  await mkdir(outputDir, { recursive: true });
  const klingPath = join(outputDir, "kling.md");
  const seedancePath = join(outputDir, "seedance.md");
  const modelAgentPath = join(outputDir, "model-agent.md");
  await writeFile(klingPath, buildKlingPrompt(options.slidesDocument), "utf8");
  await writeFile(seedancePath, buildSeedancePrompt(options.slidesDocument), "utf8");
  await writeFile(modelAgentPath, buildModelAgentPrompt(options.slidesDocument), "utf8");
  return [klingPath, seedancePath, modelAgentPath, ...(await writePerImageModelPrompts(options))];
}

function buildKlingPrompt(slidesDocument: SlidesDocument): string {
  return [
    "# Kling App Ad Prompt",
    "",
    "Use the exported portrait video references as single-shot references for short vertical mobile app ad plates.",
    "Do not upload all references into one generation. Generate one 2-4 second clip per reference image, then edit clips together after generation.",
    "Input safety rule: do not send images containing a real person, photoreal face, realistic body, or identifiable human to Seedance/Kling. Regenerate the sheet as scratch line art first.",
    "Output style rule: convert the scratch reference into live-action-looking footage. Do not preserve pencil, paper, arrows, labels, or storyboard style.",
    "Do not ask the video model to preserve or redraw app screens. Generate a physical matte chroma-green tracking card over the phone display, then composite real screenshots after generation.",
    "Use each reference only as motion/camera guidance: phone pickup, tap/swipe, hold, or outcome pose.",
    "Use restaurant/cafe/hospitality context. Avoid office desks, computer monitors, keyboards, and mouse setups.",
    "Keep motion natural, camera controlled, no subtitles, no watermark, no fake review text, no generated UI.",
    "",
    "Reference images:",
    referenceList(slidesDocument)
  ].join("\n");
}

function buildSeedancePrompt(slidesDocument: SlidesDocument): string {
  return [
    "# Seedance 2.0 App Ad Prompt",
    "",
    "Generate the app ad as separate short live-action plates, one reference image per Seedance run.",
    "Do not upload all 12 references at once. Pick one image, generate a 2-4 second clip, then repeat for the next shot.",
    "The input reference must be scratch-style and non-photoreal with no real person, no photoreal face, no realistic body, and no identifiable human.",
    `Do not attach source screenshots from ${APP_ADS_SOURCE_CONTACT_SHEET} to Seedance. Use them only after generation for compositing.`,
    "The output must be live-action-looking footage, not pencil sketch or paper storyboard animation.",
    "Phone screen rule: the phone display is covered by a physical matte chroma-green tracking card/sticker. It is not a powered-on display.",
    "Do not generate app UI, app text, buttons, labels, numbers, translated words, iOS settings, control center, icons, or fake QuickShift screens.",
    "Use restaurant/cafe/hospitality context. Avoid office desks, computer monitors, keyboards, and mouse setups.",
    "Prioritize stable trackable phone geometry, hands outside the green rectangle, and clear short action.",
    "After video generation, composite exact source screenshots onto the green screen plane. No subtitles, no added marketing copy, no watermarks, no fake brand text.",
    "",
    "Reference images:",
    referenceList(slidesDocument)
  ].join("\n");
}

function buildModelAgentPrompt(slidesDocument: SlidesDocument): string {
  return [
    "# App Ads Model Agent Prompt",
    "",
    "You are the video-model operator for an OpenLoop mobile app ad workflow.",
    "",
    "Goal:",
    "Turn the provided scratch-style app-ad shot references into separate 2-4 second vertical live-action plates, then edit those clips into one 10-15 second app ad.",
    "",
    "Input assets to attach:",
    "- Attach one image from modules/app-ads/export/video-references/images/ at a time.",
    "- Do not attach all 12 references into a single Seedance/Kling generation.",
    "- Review copies in modules/app-ads/export/slides/ are the same shot references; prefer modules/app-ads/export/video-references/images/ for model input.",
    `- App screenshot source sheet for post-production overlay only: ${APP_ADS_SOURCE_CONTACT_SHEET}`,
    "",
    "Recommended model:",
    "- Use Seedance 2.0 if it supports multiple reference images in your current tool.",
    "- Use Kling if Seedance is unavailable or if Kling gives better phone-hand realism.",
    "",
    "Required workflow:",
    "0. Confirm each reference is a single shot with a chroma-green phone screen and no app UI pixels.",
    "1. Pick one reference image.",
    "2. Paste the matching per-image prompt from modules/app-ads/export/video-references/prompts/slide-XX-seedance.md.",
    "3. Generate a 2-4 second vertical 9:16 plate. Do not ask Seedance to combine the full workflow.",
    "4. Reject any output that generates UI, settings screens, control center, icons, labels, or fake app screens.",
    "5. Repeat for the strongest 4-6 shots first; only generate all 12 if needed.",
    `6. Composite exact app screenshots from ${APP_ADS_SOURCE_CONTACT_SHEET} after generation. Do not add subtitles, captions, watermarks, large marketing text, fake reviews, or synthetic UI overlays.`,
    "",
    "Suggested edit pacing:",
    "- 0.0-2.0s: roster pressure or phone pickup.",
    "- 2.0-5.0s: two close phone interactions.",
    "- 5.0-8.0s: request/approval/team notification beat.",
    "- 8.0-11.0s: attendance/hours/payroll outcome.",
    "- 11.0-15.0s: final confident phone shot.",
    "",
    "Quality checks before final:",
    "- Input sheets contain no real or photoreal person.",
    "- Phone screen stays plausible and aligned inside device.",
    "- Phone screen is a chroma-green physical card/sticker.",
    "- No generated app UI or text appears in the phone screen.",
    "- Source screenshots can be composited without text/language drift.",
    "- Hands are natural and not distorted.",
    "- Motion follows the numbered workflow, not random lifestyle footage.",
    "- The final video can be used as a first draft for app advertising.",
    "",
    "Reference images:",
    referenceList(slidesDocument),
    `- app-screenshot-contact-sheet: ${APP_ADS_SOURCE_CONTACT_SHEET}`
  ].join("\n");
}

function referenceList(slidesDocument: SlidesDocument): string {
  return slidesDocument.slides
    .map((slide) => `- ${slide.role}: ${appAdsVideoReferenceRelativePath(slide.slideNumber)}`)
    .join("\n");
}
