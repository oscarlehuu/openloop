import OpenAI from "openai";
import { z } from "zod";
import { OpenLoopConfig } from "../config/openloop-config.js";
import { codexHeaders } from "../providers/codex-oauth/codex-headers.js";
import { resolveCodexAccessToken } from "../providers/codex-oauth/codex-token-refresh.js";
import { OpenLoopError } from "../shared/errors.js";
import { ProjectBrief } from "../scanner/project-scanner.js";
import { WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { buildPlannerPrompt, plannerInstructions } from "./codex-planner-prompts.js";
import type { PlannerContext } from "./campaign-planner.js";
import { CampaignIdea, campaignIdeaSchema, slideSchema, SlidesDocument } from "./slide-schema.js";

export async function planCampaignWithCodex(
  brief: ProjectBrief,
  config: OpenLoopConfig,
  workflow: WorkflowDefinition,
  context: PlannerContext = {}
): Promise<{ idea: CampaignIdea; slidesDocument: SlidesDocument }> {
  const accessToken = await resolveCodexAccessToken();
  const client = new OpenAI({
    apiKey: accessToken,
    baseURL: "https://chatgpt.com/backend-api/codex",
    defaultHeaders: codexHeaders(accessToken)
  });
  const text = await collectPlannerText(client, {
    model: config.image.chatModel,
    store: false,
    instructions: plannerInstructions(workflow),
    input: [
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: buildPlannerPrompt(brief, workflow, context) }]
      }
    ]
  });
  if (!text) throw new OpenLoopError("Codex planner returned no text.", "CODEX_PLANNER_EMPTY");
  const parsed = parsePlannerResponse(text, workflow);
  return {
    idea: parsed.idea,
    slidesDocument: {
      schemaVersion: 1,
      brief,
      slides: parsed.slides
    }
  };
}

async function collectPlannerText(client: OpenAI, payload: unknown): Promise<string | undefined> {
  const streamFactory = (client.responses as unknown as { stream?: (body: unknown) => AsyncIterable<unknown> }).stream;
  if (!streamFactory) throw new OpenLoopError("Codex planner streaming is unavailable.", "CODEX_PLANNER_STREAM_MISSING");

  const chunks: string[] = [];
  const stream = streamFactory.call(client.responses, payload);
  for await (const event of stream) {
    const delta = textDeltaFromEvent(event);
    if (delta) chunks.push(delta);
  }
  if (chunks.length) return chunks.join("");

  const maybeFinal = stream as unknown as { finalResponse?: () => Promise<unknown> };
  if (maybeFinal.finalResponse) return responseText(await maybeFinal.finalResponse());
  return undefined;
}

function textDeltaFromEvent(event: unknown): string | undefined {
  const typed = event as { type?: string; delta?: unknown };
  if (typed.type === "response.output_text.delta" && typeof typed.delta === "string") return typed.delta;
  return undefined;
}

function responseText(response: unknown): string | undefined {
  const typed = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: string }>; text?: unknown }>;
  };
  if (typeof typed.output_text === "string") return typed.output_text;
  const chunks: string[] = [];
  for (const item of typed.output ?? []) {
    if (typeof item.text === "string") chunks.push(item.text);
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.length ? chunks.join("\n") : undefined;
}

function parsePlannerResponse(
  text: string,
  workflow: WorkflowDefinition
): { idea: CampaignIdea; slides: SlidesDocument["slides"] } {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as { slides?: unknown[] };
    const normalized = {
      ...parsed,
      slides: (parsed.slides ?? []).map((slide, index) =>
        normalizePlannerSlide(typeof slide === "object" && slide ? slide : {}, index, workflow)
      )
    };
    return z
      .object({
        idea: campaignIdeaSchema,
        slides: z.array(slideSchema).length(workflow.assetCount)
      })
      .parse(normalized);
  } catch (error) {
    throw new OpenLoopError(
      "Codex planner returned invalid campaign JSON.",
      "CODEX_PLANNER_INVALID_JSON",
      error instanceof Error ? error.message : undefined
    );
  }
}

function normalizePlannerSlide(slide: object, index: number, workflow: WorkflowDefinition): object {
  const normalized = {
    ...slide,
    slideNumber: index + 1,
    role: workflow.roles[index]
  } as Record<string, unknown>;
  if (
    workflow.id === "app-store-screenshot" &&
    normalized.overlayText &&
    typeof normalized.overlayText === "object"
  ) {
    const overlay = normalized.overlayText as Record<string, unknown>;
    normalized.overlayText = {
      headline: overlay.headline,
      subtitle: overlay.subtitle,
      cta: overlay.cta
    };
  }
  return normalized;
}

function extractJsonObject(text: string): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fence?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new OpenLoopError("Codex planner returned text without a JSON object.", "CODEX_PLANNER_INVALID_JSON");
  }
  return candidate.slice(start, end + 1);
}
