import { ProjectBrief } from "../scanner/project-scanner.js";
import { WorkflowDefinition } from "../workflows/workflow-definitions.js";
import type { PlannerContext } from "./campaign-planner.js";

export function plannerInstructions(workflow: WorkflowDefinition): string {
  if (workflow.id === "app-ads") {
    return [
      "You are OpenLoop's mobile app ads storyboard planner.",
      "Return only valid JSON. No markdown.",
      `Workflow: ${workflow.label}. ${workflow.plannerDescription}`,
      "Use concrete product domain evidence: App Store copy, landing copy, docs, text literals, function names.",
      "Plan twelve generated single-shot references. Each asset is one shot only, not a storyboard sheet, not a grid, and not a collage.",
      "Do not ask the image model to use, redraw, preserve, or imitate app screenshots. The real screenshot contact sheet is for post-production compositing only.",
      "Every phone screen must be a physical matte chroma-green tracking card/sticker, not a powered-on display.",
      "Never request app UI, labels, screens, logos, fake product states, iOS settings, control center, icons, buttons, charts, rows, cards, or readable text inside the phone.",
      "Do not include real people, photoreal humans, faces, eyes, skin texture, portrait photography, realistic bodies, celebrity likeness, or identifiable persons. Use faceless mannequin silhouettes, line-art hands, icons, and drawn phones only.",
      "Use hospitality environments: restaurant pass, cafe counter, POS terminal, apron/staff cue, service counter, warm practical lighting. Avoid offices, monitors, keyboards, and mouse setups.",
      "Every imagePrompt must include a [PANEL SEQUENCE] section with one numbered shot, specific camera/action notes, and a trackable chroma-green phone screen.",
      "Set sourceImagePath to shared/source/app-screenshots/contact-sheet.png for every asset so the screenshot source is copied into the run, but explicitly say screenshots are post-production only.",
      "Do not request landscape 16:9, baked-in subtitles, big marketing copy, watermarks, brand titles, or fake reviews."
    ].join(" ");
  }
  if (workflow.id === "app-store-screenshot") {
    return [
      "You are OpenLoop's App Store screenshot planner.",
      "Return only valid JSON. No markdown.",
      `Workflow: ${workflow.label}. ${workflow.plannerDescription}`,
      "Use concrete product domain evidence: App Store copy, landing copy, docs, text literals, function names.",
      "Before writing the plan, assess whether the provided before.click inspiration fits this app category, audience, and product value. Use only suitable references.",
      "If before.click references are present, extract art-direction patterns from them: composition, typography hierarchy, background treatment, device framing, color rhythm, screenshot scale, and first-screen hook.",
      "If references are weak or unrelated, use them only as negative guidance and choose a cleaner App Store screenshot direction from the product evidence.",
      "Plan assets around real app screenshots, but remember OpenLoop composes the screenshot and phone frame after image generation.",
      "Every imagePrompt must describe only the text-free background plate: mood, background, lighting, negative space, color rhythm, and suitable inspiration pattern.",
      "Do not ask the image model to place a phone, device, screenshot, app UI, labels, screens, logos, product states, counters, badges, or readable text.",
      "Reserve a clean left-side copy column, roughly the left 40% of the image, and a clear right-side area for deterministic phone composition.",
      "Keep screenshot/crop instructions in captionNotes or visualContinuity only if needed; the imagePrompt itself must stay background-only.",
      "Use inspiration to replicate design principles, not exact apps. Do not copy reference app brands, UI content, copy, exact layout, color palette one-to-one, logos, or screenshots.",
      "Include sourceImagePath for each asset. Use shared/source/app-screenshots/slide-01.png, shared/source/app-screenshots/slide-02.png, etc. unless a better real screenshot path is known.",
      "Marketing overlay copy is rendered locally. Existing readable UI text inside the real screenshot is allowed. Do not include eyebrow counters such as 1/5 or 2/5."
    ].join(" ");
  }
  return [
    "You are OpenLoop's campaign planner.",
    "Return only valid JSON. No markdown.",
    `Workflow: ${workflow.label}. ${workflow.plannerDescription}`,
    "Use concrete product domain evidence: landing copy, App Store copy, docs, text literals, function names.",
    "Do not produce generic software-workspace prompts unless the project is actually a developer tool.",
    "Every imagePrompt must describe a concrete 9:16 no-text AI-generated scene for the product's actual users.",
    "These slide visuals do not need to show the real app UI or screenshots.",
    "Never ask the image model to render words, UI labels, logos, screenshots, or readable text.",
    "Include short overlayText for each asset; OpenLoop renders the text locally.",
    "Keep image prompts detailed and visual."
  ].join(" ");
}

export function buildPlannerPrompt(
  brief: ProjectBrief,
  workflow: WorkflowDefinition,
  context: PlannerContext = {}
): string {
  return [
    "Build a product-specific campaign plan for this project.",
    `Workflow id: ${workflow.id}`,
    `Workflow goal: ${workflow.plannerDescription}`,
    "",
    `Project name: ${brief.projectName}`,
    `Current heuristic summary: ${brief.summary}`,
    `Current heuristic audience: ${brief.audience}`,
    `Current heuristic value props: ${brief.valueProps.join("; ")}`,
    "",
    "Evidence snippets:",
    evidenceBundle(brief),
    appStoreInspirationSection(context),
    "",
    "Rules:",
    `- Return exactly ${workflow.assetCount} assets in this role order: ${workflow.roles.join(", ")}.`,
    `- Use slideNumber 1 through ${workflow.assetCount}.`,
    "- Use only the role values listed above; OpenLoop will normalize them if needed.",
    workflow.id === "app-ads"
      ? "- These are twelve single-shot app-ad video references. Do not invent fake app UI; the phone screen must be a physical chroma-green tracking card."
      : workflow.id === "app-store-screenshot"
      ? "- These are App Store screenshot assets made from provided real app screenshots. Do not invent fake app UI."
      : "- These are 9:16 social slides. Use AI-generated visual metaphors; no real app screenshot is required.",
    workflow.id === "app-ads"
      ? "- Set sourceImagePath to shared/source/app-screenshots/contact-sheet.png for each asset."
      : workflow.id === "app-store-screenshot"
      ? "- Set sourceImagePath to shared/source/app-screenshots/slide-XX.png for each matching real screenshot."
      : "",
    workflow.id === "app-store-screenshot"
      ? "- For overlayText, return headline and optional subtitle/cta only. Do not include eyebrow or slide counters."
      : "",
    workflow.id === "app-store-screenshot"
      ? "- In imagePrompt, instruct the image model to generate a background plate only. Do not ask it to render phones, screenshots, UI, counters, or text."
      : "",
    workflow.id === "app-ads"
      ? "- Use portrait 2:3 single-shot images. Each imagePrompt must describe one shot only, not a sheet, grid, or multi-panel storyboard."
      : "",
    workflow.id === "app-ads"
      ? "- Each shot must describe user action, camera framing, hospitality context, green-screen phone card, and motion direction. Use scratch-sketch style only; no real people, no photoreal humans, no faces, no office desk."
      : "",
    "",
    "JSON shape:",
    JSON.stringify(
      {
        idea: {
          schemaVersion: 1,
          angle: "specific campaign angle",
          audience: "specific target buyer/user",
          pain: "specific pain",
          promise: "specific promise",
          cta: "specific CTA",
          caption: "short social caption"
        },
        slides: [
          {
            slideNumber: 1,
            role: workflow.roles[0],
            overlayText:
              workflow.id === "app-store-screenshot"
                ? { headline: "short headline", subtitle: "short subtitle" }
                : workflow.overlayMode === "render"
                ? { eyebrow: `1/${workflow.assetCount}`, headline: "short headline", subtitle: "short subtitle" }
                : undefined,
            imagePrompt: "specific no-text background plate",
            sourceImagePath:
              workflow.id === "app-ads"
                ? "shared/source/app-screenshots/contact-sheet.png"
                : workflow.id === "app-store-screenshot"
                ? "shared/source/app-screenshots/slide-01.png"
                : undefined,
            captionNotes: "short note",
            visualContinuity:
              workflow.id === "app-ads"
                ? "same faceless sketch operator, drawn phone, chroma-green tracking card, hospitality setting, no real person"
                : "same character/location/style continuity"
          }
        ]
      },
      null,
      2
    )
  ].join("\n");
}

function appStoreInspirationSection(context: PlannerContext): string {
  if (!context.appStoreInspiration) return "";
  return [
    "",
    "App Store inspiration context:",
    context.appStoreInspiration.plannerContext,
    "",
    "Planner task:",
    "- Judge which references fit this product and ignore weak matches.",
    "- Summarize the useful pattern inside each imagePrompt.",
    "- Keep final assets original and based on the real source screenshots.",
    "- Preserve a clear left-side text column so rendered copy never lands on top of the phone or app UI.",
    "- Do not put phone/device/UI placement instructions in imagePrompt; OpenLoop handles that in rendering."
  ].join("\n");
}

function evidenceBundle(brief: ProjectBrief): string {
  const snippets = brief.sourceSnippets.length
    ? brief.sourceSnippets
    : brief.sourceFiles.map((path) => ({ path, content: "" }));
  return snippets
    .map((snippet) => `--- ${snippet.path}\n${snippet.content.slice(0, 7000)}`)
    .join("\n\n")
    .slice(0, 45000);
}
