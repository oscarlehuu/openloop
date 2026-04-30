import { ProjectBrief } from "../scanner/project-scanner.js";
import { defaultSourceImagePath } from "../workflows/image-generation-strategies.js";
import { resolveWorkflow, WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { APP_ADS_SHOTS, buildAppAdsPrompt } from "./app-ads-local-prompts.js";
import type { PlannerContext } from "./campaign-planner.js";
import { CampaignIdea, SlidesDocument } from "./slide-schema.js";

export function generateCampaignIdea(
  brief: ProjectBrief,
  workflow: WorkflowDefinition = resolveWorkflow()
): CampaignIdea {
  const primaryValue = brief.valueProps[0] ?? "turns project context into useful marketing assets";
  return {
    schemaVersion: 1,
    angle: `${brief.projectName} as the faster path from messy work to a usable result`,
    audience: brief.audience,
    pain: "The product is useful, but the story is hard to explain quickly.",
    promise: primaryValue,
    cta: workflow.id === "app-store-screenshot" ? "Download and try the focused workflow." : "Try the workflow on one real project.",
    caption: captionForWorkflow(brief.projectName, workflow)
  };
}

export function generateSlides(
  brief: ProjectBrief,
  idea: CampaignIdea,
  workflow: WorkflowDefinition = resolveWorkflow(),
  context: PlannerContext = {}
): SlidesDocument {
  const continuity =
    workflow.id === "app-ads"
      ? `${workflow.label}: same app screenshot contact sheet, same scratch-sketch style, no real or photoreal people.`
      : workflow.id === "app-store-screenshot"
      ? `${workflow.label}: real app screenshots stay truthful with consistent device framing and before.click-inspired art direction.`
      : `${workflow.label}: same product domain, coherent visual style, no readable text.`;
  const slideInputs = localSlideInputs(brief, idea, workflow);

  return {
    schemaVersion: 1,
    brief,
    slides: slideInputs.map(([role, headline, subtitle], index) => ({
      slideNumber: index + 1,
      role,
      overlayText:
        workflow.overlayMode === "render"
          ? {
              eyebrow: workflow.id === "app-store-screenshot" ? undefined : `${index + 1}/${workflow.assetCount}`,
              headline,
              subtitle,
              cta: index === workflow.assetCount - 1 ? idea.cta : undefined
            }
          : undefined,
      imagePrompt: buildImagePrompt(brief, role, index + 1, workflow, context),
      sourceImagePath: defaultSourceImagePath(index + 1, workflow),
      captionNotes: `${role}: ${headline}`,
      visualContinuity: continuity
    }))
  };
}

function localSlideInputs(
  brief: ProjectBrief,
  idea: CampaignIdea,
  workflow: WorkflowDefinition
): Array<[string, string, string]> {
  const social: Array<[string, string, string]> = [
    ["hook", "Your product is good. The story is the bottleneck.", brief.summary],
    ["problem", "Raw project context does not sell itself.", idea.pain],
    ["discovery", "Turn the repo into a campaign brief.", idea.promise],
    ["transformation-1", "One idea becomes six visual beats.", "Each slide carries one job in the story."],
    ["transformation-2", "Images stay clean. Copy stays editable.", "No baked-in AI text, no broken typography."],
    ["cta", "Create the first campaign locally.", idea.cta]
  ];
  const appStore: Array<[string, string, string]> = [
    ["store-hook", brief.projectName, brief.summary],
    ["main-use-case", "Built for the real daily workflow.", idea.audience],
    ["key-feature", "One clear path to the outcome.", idea.promise],
    ["user-outcome", "Less manual work, faster decisions.", idea.pain],
    ["install-cta", "Start with one focused task.", idea.cta]
  ];
  if (workflow.id === "app-ads") return APP_ADS_SHOTS.map(({ role, headline, subtitle }) => [role, headline, subtitle]);
  if (workflow.id === "app-store-screenshot") return appStore;
  return social;
}

function buildImagePrompt(
  brief: ProjectBrief,
  role: string,
  slideNumber: number,
  workflow: WorkflowDefinition,
  context: PlannerContext = {}
): string {
  if (workflow.id === "app-store-screenshot") {
    return [
      `App Store asset ${slideNumber} background plate: ${role}.`,
      context.appStoreInspiration
        ? `Use before.click references from ${context.appStoreInspiration.styleBriefPath} only for background art direction: composition, background treatment, color rhythm, and premium negative space.`
        : "Use polished App Store design patterns: strong hierarchy, concise benefit-led overlay space, premium framing, and app-category-appropriate color.",
      "Generate background only. Keep the left 40% copy column calm and the right 60% ready for a device frame that OpenLoop will add later.",
      "No phones, devices, app UI, screenshots, cards, icons, badges, counters, numbers, text, logos, or readable typography.",
      "Use QuickShift-aligned greens, soft sage, charcoal, clean lighting, and subtle depth."
    ].join(" ");
  }
  if (workflow.id === "app-ads") {
    return buildAppAdsPrompt(brief, role);
  }
  const subject = `${brief.projectName} represented as an editorial visual metaphor for ${brief.audience}`;
  return [
    `${subject}.`,
    `9:16 social slide ${slideNumber} visual beat: ${role}.`,
    "Original AI-generated scene, premium product-marketing style, realistic lighting, strong focal point.",
    "It does not need to show the real app UI or screenshots.",
    "Leave clean negative space for local text overlay.",
    "No words, no letters, no UI text, no logos, no watermarks, no readable typography."
  ].join(" ");
}

function captionForWorkflow(projectName: string, workflow: WorkflowDefinition): string {
  if (workflow.id === "app-store-screenshot") {
    return `${projectName} turns product value into a focused App Store screenshot set.`;
  }
  if (workflow.id === "app-ads") {
    return `${projectName} becomes a mobile app ad storyboard for video generation.`;
  }
  return `${projectName} takes a messy product story and turns it into a clear six-slide narrative.`;
}
