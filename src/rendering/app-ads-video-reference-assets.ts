import { access, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { type Slide, type SlidesDocument } from "../campaign/slide-schema.js";
import { rawImageRelativePath } from "../runs/campaign-layout.js";
import { readManifest } from "../runs/run-store.js";
import { OpenLoopError } from "../shared/errors.js";
import { formatList } from "./app-ads-video-prompt-content.js";

export const APP_ADS_VIDEO_REFERENCE_DIR = "modules/app-ads/export/video-references/images";
export const APP_ADS_VIDEO_REFERENCE_PROMPT_DIR = "modules/app-ads/export/video-references/prompts";

export const APP_ADS_VIDEO_REFERENCE_INSTRUCTIONS = [
  "Generate a clean non-photoreal single-shot app-ad video reference for a video model.",
  "This asset is not the final ad and must not preserve real app UI.",
  "Use a physical matte chroma-green tracking card or sticker over the phone display.",
  "Do not render app screenshots, UI labels, letters, numbers, readable text, fake buttons, or fake product screens.",
  "The green phone screen plane must stay visually plain: no wireframes, grids, rows, cards, charts, bars, menu lines, placeholder UI, or form fields.",
  "Do not write the project name, brand name, sheet title, headings, captions, or any other readable words.",
  "Keep one phone, one action, one camera direction, and a clear trackable screen plane for Seedance or Kling."
].join(" ");

export function appAdsVideoReferenceRawPath(runPath: string, slideNumber: number): string {
  return join(runPath, "modules", "app-ads", "raw", "video-references", `slide-${idFor(slideNumber)}.png`);
}

export function appAdsVideoReferencePath(runPath: string, slideNumber: number): string {
  return join(runPath, appAdsVideoReferenceRelativePath(slideNumber));
}

export function appAdsVideoReferenceRelativePath(slideNumber: number): string {
  return `${APP_ADS_VIDEO_REFERENCE_DIR}/slide-${idFor(slideNumber)}.png`;
}

export function appAdsVideoReferencePromptPath(runPath: string, slideNumber: number, model: string): string {
  return join(runPath, APP_ADS_VIDEO_REFERENCE_PROMPT_DIR, `slide-${idFor(slideNumber)}-${model}.md`);
}

export function buildAppAdsVideoReferencePrompt(slidesDocument: SlidesDocument, slide: Slide): string {
  const context = {
    slide,
    imagePath: appAdsVideoReferenceRelativePath(slide.slideNumber),
    contactSheetPath: "shared/source/app-screenshots/contact-sheet.png",
    projectName: slidesDocument.brief.projectName,
    audience: slidesDocument.brief.audience,
    summary: slidesDocument.brief.summary,
    valueProps: slidesDocument.brief.valueProps
  };
  return [
    `Create a portrait 2:3 clean single-shot video reference for ${context.projectName}.`,
    "Purpose: guide one Seedance/Kling short live-action plate only.",
    "Do not use or redraw real app UI. Do not include app screenshots in any phone screen.",
    "The phone display must be covered by a flat matte chroma-green physical tracking card for later screenshot compositing.",
    "The green plane must be visually plain with no wireframes, grids, rows, cards, charts, bars, menu lines, placeholder UI, or form fields.",
    "Allowed readable marks: small shot number and simple camera/action arrows only.",
    "Do not write the product name, brand name, sheet title, captions, labels, or any other readable words.",
    "Use a scratch single-shot reference style with drawn phone, simplified hands, neutral paper, and clear action.",
    `Audience: ${context.audience}.`,
    `Product context: ${context.summary}`,
    `Value props to imply through action: ${formatList(context.valueProps)}.`,
    "",
    "Panel/action guide with app UI replaced by blank screen planes:",
    cleanPanelGuide(slide)
  ].join("\n");
}

export async function renderAppAdsVideoReferences(runPath: string, slidesDocument: SlidesDocument): Promise<string[]> {
  const outputDir = join(runPath, APP_ADS_VIDEO_REFERENCE_DIR);
  await mkdir(outputDir, { recursive: true });
  const outputs: string[] = [];
  for (const slide of slidesDocument.slides) {
    const rawPath = await resolveAppAdsVideoReferenceRawPath(runPath, slide.slideNumber);
    if (!(await fileExistsWithContent(rawPath))) {
      throw new OpenLoopError(
        `Missing clean video reference raw image for slide ${idFor(slide.slideNumber)}.`,
        "VIDEO_REFERENCE_REQUIRED",
        `Regenerate images with: openloop generate:images --run ${runPath} --force`
      );
    }
    const outputPath = appAdsVideoReferencePath(runPath, slide.slideNumber);
    await sharp(rawPath).resize(1024, 1536, { fit: "cover" }).png().toFile(outputPath);
    outputs.push(outputPath);
  }
  return outputs;
}

async function resolveAppAdsVideoReferenceRawPath(runPath: string, slideNumber: number): Promise<string> {
  const explicitCleanPath = appAdsVideoReferenceRawPath(runPath, slideNumber);
  if (await fileExistsWithContent(explicitCleanPath)) return explicitCleanPath;
  const id = idFor(slideNumber);
  const candidates = [
    join(runPath, "images", `video-reference-slide-${id}-raw.png`),
    await manifestRawImagePath(runPath, slideNumber),
    join(runPath, "images", `slide-${id}-raw.png`)
  ].filter((path): path is string => Boolean(path));
  for (const candidate of candidates) {
    if (await fileExistsWithContent(candidate)) return candidate;
  }
  return candidates[0];
}

async function manifestRawImagePath(runPath: string, slideNumber: number): Promise<string | undefined> {
  try {
    return join(runPath, rawImageRelativePath(await readManifest(runPath), slideNumber));
  } catch {
    return undefined;
  }
}

function idFor(slideNumber: number): string {
  return String(slideNumber).padStart(2, "0");
}

async function fileExistsWithContent(path: string): Promise<boolean> {
  try {
    await access(path);
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

function cleanPanelGuide(slide: Slide): string {
  const prompt = slide.imagePrompt.trim();
  const marker = ["[PANEL SEQUENCE]", "[STORYBOARD SEQUENCE]", "[MOTION SEQUENCE]"].find((item) =>
    prompt.includes(item)
  );
  if (!marker) return cleanReferenceText(`${slide.captionNotes}. ${slide.visualContinuity}`);
  const start = prompt.indexOf(marker);
  const endMarkers = ["[DETAIL]", "[VISUAL STYLE]", "[GRID LAYOUT]", "[PANEL STRUCTURE]", "Camera and styling notes:"];
  const end = endMarkers
    .map((item) => prompt.indexOf(item, start + marker.length))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  return cleanReferenceText(prompt.slice(start, end ?? undefined).trim());
}

function cleanReferenceText(text: string): string {
  return text
    .replace(/provided app screenshot contact sheet/gi, "product workflow notes")
    .replace(/same real app screenshot contact sheet/gi, "same product workflow plan")
    .replace(/app screenshot contact sheet/gi, "product workflow notes")
    .replace(/contact[- ]sheet crop of [^.;]+/gi, "blank phone screen-replacement plane")
    .replace(/full contact[- ]sheet mini montage[^.;]*/gi, "blank screen-replacement workflow montage reserved for post-production overlay")
    .replace(/contact sheet/gi, "product workflow notes")
    .replace(/taped screenshot crops?[^.;]*/gi, "blank screen-replacement cards reserved for post-production overlay")
    .replace(/authentic [^.;]+ screen[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/another authentic [^.;]+ screen[^.;]*/gi, "blank phone screen-replacement plane")
    .replace(/same QuickShift contact sheet/gi, "same post-production overlay source")
    .replace(/app screenshots?/gi, "post-production overlay source")
    .replace(/traced real [^.;]+ screenshots?/gi, "blank phone screen-replacement planes")
    .replace(/real [^.;]+ screenshots?/gi, "blank phone screen-replacement planes")
    .replace(/real [^.;]+ screen variation/gi, "blank phone screen-replacement plane")
    .replace(/real [^.;]+ \bscreen\b/gi, "blank phone screen-replacement plane")
    .replace(/blank phone screen-replacement plane of the [^.;]+ \bscreen\b/gi, "blank phone screen-replacement plane")
    .replace(
      /(roster calendar|calendar week|request|notification|approval|attendance|worked-hours|payroll report|admin overview|reporting|export)[^.;]*\bscreen\b/gi,
      "blank phone screen-replacement plane"
    )
    .replace(/real notification\/request\/approval item/gi, "blank screen-replacement target")
    .replace(/real attendance\/worked-hours\/payroll review screens?/gi, "blank screen-replacement poses")
    .replace(/rostered-hours screen/gi, "blank screen-replacement pose")
    .replace(/one day cell to another/gi, "one blank target area to another")
    .replace(/without changing labels/gi, "without generating labels")
    .replace(/review staff profiles/gi, "review blank workflow cues")
    .replace(/list item/gi, "blank target")
    .replace(/same QuickShift screenshot contact sheet/gi, "same post-production overlay source")
    .replace(/QuickShift screenshot contact sheet/gi, "post-production overlay source")
    .replace(/\b(wireframes?|grids?|rows?|cards?|charts?|bars?|menu lines?|placeholder UI|form fields?)\b/gi, "blank plane")
    .replace(/showing a real [^.;]+ \bscreen\b/gi, "showing a blank screen-replacement plane")
    .replace(/sourced from screenshot/gi, "planned for later overlay")
    .replace(/sourced for later source-screenshot overlay/gi, "planned for later overlay")
    .replace(/visible in the actual screenshot/gi, "planned for later overlay")
    .replace(/visible in the actual UI/gi, "planned for later overlay")
    .replace(/visible on the real UI/gi, "planned for later overlay")
    .replace(/visible on real UI/gi, "planned for later overlay")
    .replace(/if present in screenshot[^.;]*/gi, "on the blank screen-replacement plane")
    .replace(/shift blocks?/gi, "blank overlay target areas")
    .replace(/request chip or swap-related area/gi, "blank overlay target area")
    .replace(/pending shift-change item/gi, "blank overlay target area")
    .replace(/publish-related area/gi, "blank overlay target area")
    .replace(/approve or action control/gi, "blank overlay target")
    .replace(/export\/report\/detail affordance/gi, "blank overlay target")
    .replace(/primary continue\/sign-up area/gi, "blank overlay target")
    .replace(/roster\/schedule view/gi, "blank roster overlay target")
    .replace(/report\/export-related view/gi, "blank report overlay target")
    .replace(/owner\/business setup or account flow/gi, "blank onboarding overlay target")
    .replace(/\ban blank\b/gi, "a blank");
  }
