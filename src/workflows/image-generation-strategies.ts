import { Slide } from "../campaign/slide-schema.js";
import { campaignLayout, sourceImagePathForSlide } from "../runs/campaign-layout.js";
import { WorkflowDefinition } from "./workflow-definitions.js";

export interface ImageGenerationStrategy {
  id: WorkflowDefinition["imageStrategyId"];
  targetAspect: string;
  requiresSourceImage: boolean;
  sourceDirectory?: string;
  sharedSourceImagePath?: string;
  imageSize?: string;
  providerInstructions: string;
}

const SOCIAL_SLIDE_STRATEGY: ImageGenerationStrategy = {
  id: "social-slide-ai",
  targetAspect: "9:16",
  requiresSourceImage: false,
  providerInstructions: [
    "Generate exactly one vertical 9:16 social slide background image using the image_generation tool.",
    "This is an AI-generated marketing visual, not an App Store screenshot and not a literal app UI capture.",
    "Do not include readable text, letters, logos, watermarks, or UI labels. OpenLoop renders all copy later."
  ].join(" ")
};

const APP_STORE_SCREENSHOT_STRATEGY: ImageGenerationStrategy = {
  id: "app-store-real-screenshot",
  targetAspect: "App Store background plate",
  requiresSourceImage: true,
  sourceDirectory: "shared/source/app-screenshots",
  providerInstructions: [
    "Generate exactly one text-free App Store background plate.",
    "OpenLoop will compose the real app screenshot, device frame, and marketing copy later with deterministic code.",
    "Do not draw phones, devices, app UI, screenshots, widgets, icons, charts, controls, logos, text, numbers, badges, counters, or page indicators.",
    "Use only abstract composition cues: premium gradient field, subtle lighting, depth, brand-color rhythm, and clean negative space.",
    "Reserve the left 40% as a calm copy area and the right 60% as a clean area for a device frame that will be added later.",
    "No readable text of any kind."
  ].join(" ")
};

const APP_ADS_SCREENSHOT_BOARD_STRATEGY: ImageGenerationStrategy = {
  id: "app-ads-screenshot-board",
  targetAspect: "2:3 portrait single-shot app-ad video reference",
  requiresSourceImage: true,
  sourceDirectory: "shared/source/app-screenshots",
  sharedSourceImagePath: "shared/source/app-screenshots/contact-sheet.png",
  imageSize: "1024x1536",
  providerInstructions: [
    "Generate exactly one portrait 2:3 single-shot mobile app ad video reference.",
    "Do not use, redraw, preserve, or imitate app screenshots. Real app screenshots are for post-production only.",
    "The phone display must be a flat matte chroma-green physical tracking card or sticker, not a powered-on display.",
    "Do not render any phone operating system, app UI, icons, controls, labels, charts, rows, cards, buttons, settings screen, control center, readable text, logos, or fake product screens.",
    "Do not create real people or photoreal humans. Avoid faces, eyes, skin texture, portrait photography, realistic bodies, celebrity likeness, or any identifiable person. Use faceless line-art silhouettes, simplified hands, icons, and drawn phone frames only.",
    "Prefer hospitality context: cafe counter, restaurant pass, POS terminal nearby, apron/staff cue, warm practical lighting. Avoid office desks, computer monitors, keyboards, and mouse setups.",
    "Keep one clear phone pose, one action, one camera direction, and a screen area that will be easy to track in Seedance.",
    "Do not add subtitles, watermark text, marketing copy, review text, or sheet titles."
  ].join(" ")
};

export function resolveImageStrategy(workflow: WorkflowDefinition): ImageGenerationStrategy {
  if (workflow.imageStrategyId === "app-ads-screenshot-board") return APP_ADS_SCREENSHOT_BOARD_STRATEGY;
  if (workflow.imageStrategyId === "app-store-real-screenshot") return APP_STORE_SCREENSHOT_STRATEGY;
  return SOCIAL_SLIDE_STRATEGY;
}

export function buildProviderPrompt(slide: Slide, workflow: WorkflowDefinition): string {
  const strategy = resolveImageStrategy(workflow);
  return [
    `Workflow: ${workflow.label}.`,
    `Target aspect: ${strategy.targetAspect}.`,
    workflow.id === "app-store-screenshot"
      ? "Create an abstract background plate only; no source screenshot is attached because OpenLoop composes the real app screenshot later."
      : workflow.id === "app-ads"
      ? "Create a clean video reference only. Do not use app screenshots in the generated image; they are for post-production overlay after video generation."
      : strategy.requiresSourceImage
      ? "Use the attached real app screenshot as the app UI source. Keep screenshot content truthful."
      : "Create an original AI visual; no source screenshot is required.",
    workflow.id === "app-store-screenshot"
      ? "Generate a background plate only. Ignore any slide note about placing a phone, screenshot, device, or UI because OpenLoop composes those later."
      : "",
    slide.imagePrompt
  ].join(" ");
}

export function defaultSourceImagePath(slideNumber: number, workflow: WorkflowDefinition): string | undefined {
  const strategy = resolveImageStrategy(workflow);
  if (!strategy.requiresSourceImage) return undefined;
  if (strategy.sharedSourceImagePath) return strategy.sharedSourceImagePath;
  return sourceImagePathForSlide(slideNumber, workflow) ?? campaignLayout(workflow).sourceContactSheet;
}
