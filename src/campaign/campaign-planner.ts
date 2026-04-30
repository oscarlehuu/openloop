import { OpenLoopConfig } from "../config/openloop-config.js";
import { ProjectBrief } from "../scanner/project-scanner.js";
import { OpenLoopError } from "../shared/errors.js";
import { resolveWorkflow, WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { CampaignIdea, SlidesDocument } from "./slide-schema.js";
import { generateCampaignIdea, generateSlides } from "./campaign-generator.js";
import { planCampaignWithCodex } from "./codex-campaign-planner.js";
import type { AppStoreInspirationContext } from "../inspiration/app-store-inspiration.js";

export type PlannerMode = "codex" | "local";
export type PlannerContext = {
  appStoreInspiration?: AppStoreInspirationContext;
};

export async function planCampaign(
  brief: ProjectBrief,
  config: OpenLoopConfig,
  mode: PlannerMode,
  workflow: WorkflowDefinition = resolveWorkflow(),
  context: PlannerContext = {}
): Promise<{ idea: CampaignIdea; slidesDocument: SlidesDocument }> {
  if (mode === "codex") return planCampaignWithCodex(brief, config, workflow, context);
  const idea = generateCampaignIdea(brief, workflow);
  return { idea, slidesDocument: generateSlides(brief, idea, workflow, context) };
}

export function parsePlannerMode(value?: string): PlannerMode {
  if (!value || value === "codex") return "codex";
  if (value === "local") return "local";
  throw new OpenLoopError(`Unsupported planner: ${value}`, "UNSUPPORTED_PLANNER", "Use codex or local.");
}
