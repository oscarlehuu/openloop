import { OpenLoopError } from "../shared/errors.js";

export const WORKFLOW_IDS = ["social-carousel", "app-store-screenshot", "app-ads"] as const;

export type WorkflowId = (typeof WORKFLOW_IDS)[number];
export type OverlayMode = "render" | "raw";
export type ImageStrategyId = "social-slide-ai" | "app-store-real-screenshot" | "app-ads-screenshot-board";

export interface WorkflowDefinition {
  id: WorkflowId;
  label: string;
  assetLabel: string;
  assetCount: number;
  roles: readonly string[];
  defaultPlatform: string;
  outputPlatforms: readonly string[];
  overlayMode: OverlayMode;
  imageStrategyId: ImageStrategyId;
  requiresCaption: boolean;
  plannerDescription: string;
}

export const DEFAULT_WORKFLOW_ID: WorkflowId = "social-carousel";

const WORKFLOWS: Record<WorkflowId, WorkflowDefinition> = {
  "social-carousel": {
    id: "social-carousel",
    label: "Social carousel",
    assetLabel: "slides",
    assetCount: 6,
    roles: ["hook", "problem", "discovery", "transformation-1", "transformation-2", "cta"],
    defaultPlatform: "tiktok",
    outputPlatforms: ["tiktok"],
    overlayMode: "render",
    imageStrategyId: "social-slide-ai",
    requiresCaption: true,
    plannerDescription: "Six 9:16 TikTok/Instagram slide assets with short overlay copy and AI-generated visuals."
  },
  "app-store-screenshot": {
    id: "app-store-screenshot",
    label: "App Store screenshots",
    assetLabel: "screenshots",
    assetCount: 5,
    roles: ["store-hook", "main-use-case", "key-feature", "user-outcome", "install-cta"],
    defaultPlatform: "app-store-iphone-6-9",
    outputPlatforms: [
      "app-store-iphone-6-9",
      "app-store-iphone-6-5",
      "app-store-ipad-13",
      "app-store-ipad-12-9"
    ],
    overlayMode: "render",
    imageStrategyId: "app-store-real-screenshot",
    requiresCaption: false,
    plannerDescription: "Five App Store screenshot assets built from real app screenshots with concise marketing overlay copy."
  },
  "app-ads": {
    id: "app-ads",
    label: "App ads",
    assetLabel: "shot references",
    assetCount: 12,
    roles: [
      "shot-01-roster-pressure",
      "shot-02-phone-pickup",
      "shot-03-shift-planning",
      "shot-04-staff-review",
      "shot-05-shift-request",
      "shot-06-approval-tap",
      "shot-07-team-notified",
      "shot-08-clock-in",
      "shot-09-hours-review",
      "shot-10-payroll-report",
      "shot-11-multi-location",
      "shot-12-final-outcome"
    ],
    defaultPlatform: "storyboard-2-3",
    outputPlatforms: [],
    overlayMode: "raw",
    imageStrategyId: "app-ads-screenshot-board",
    requiresCaption: false,
    plannerDescription:
      "Twelve portrait 2:3 single-shot green-screen phone references for Seedance/Kling, with real app screenshots kept only for post-production compositing."
  }
};

export function resolveWorkflow(value?: string): WorkflowDefinition {
  const id = value ?? DEFAULT_WORKFLOW_ID;
  if (isWorkflowId(id)) return WORKFLOWS[id];
  throw new OpenLoopError(
    `Unsupported workflow: ${id}`,
    "UNSUPPORTED_WORKFLOW",
    `Use one of: ${WORKFLOW_IDS.join(", ")}`
  );
}

export function isWorkflowId(value: string): value is WorkflowId {
  return (WORKFLOW_IDS as readonly string[]).includes(value);
}

export function workflowOptionList(): string {
  return WORKFLOW_IDS.join(", ");
}
