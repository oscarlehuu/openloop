import { basename, resolve } from "node:path";
import { z } from "zod";
import { readSafeProjectSources } from "./source-readers.js";

export const projectBriefSchema = z.object({
  schemaVersion: z.literal(1),
  projectPath: z.string(),
  projectName: z.string(),
  detectedAt: z.string(),
  summary: z.string(),
  audience: z.string(),
  valueProps: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  sourceSnippets: z.array(z.object({ path: z.string(), content: z.string() })).default([])
});

export type ProjectBrief = z.infer<typeof projectBriefSchema>;

export async function scanProject(projectPath: string): Promise<ProjectBrief> {
  const absolutePath = resolve(projectPath);
  const snippets = await readSafeProjectSources(absolutePath);
  const packageJson = snippets.find((item) => item.path === "package.json");
  const productSource = selectProductSource(snippets);
  const packageName = parsePackageName(packageJson?.content);
  const projectName = packageName || basename(absolutePath);
  const sourceText = snippets.map((item) => item.content).join("\n\n");

  return {
    schemaVersion: 1,
    projectPath: absolutePath,
    projectName,
    detectedAt: new Date().toISOString(),
    summary: summarizeProject(projectName, productSource?.content ?? sourceText),
    audience: inferAudience(sourceText),
    valueProps: inferValueProps(sourceText, projectName),
    sourceFiles: snippets.map((item) => item.path),
    sourceSnippets: snippets
  };
}

function parsePackageName(content?: string): string | undefined {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as { name?: string };
    return parsed.name?.replace(/^@[^/]+\//, "");
  } catch {
    return undefined;
  }
}

function summarizeProject(projectName: string, text: string): string {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find((line) => line.length > 20 && !line.startsWith("["));
  return firstMeaningfulLine ?? `${projectName} is a software project needing a clear marketing story.`;
}

function selectProductSource(snippets: { path: string; content: string }[]): { path: string; content: string } | undefined {
  return snippets.find((item) => {
    const lower = item.path.toLowerCase();
    return (
      lower.includes("appstore") ||
      lower.includes("landing") ||
      lower.includes("codebase-summary") ||
      lower.endsWith("claude.md")
    );
  }) ?? snippets[0];
}

function inferAudience(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("restaurant") || lower.includes("roster") || lower.includes("shift")) {
    return "restaurant and hospitality owners, managers, and staff teams";
  }
  if (lower.includes("developer") || lower.includes("api")) return "technical builders and software teams";
  if (lower.includes("shopify") || lower.includes("commerce")) return "online business operators";
  if (lower.includes("mobile") || lower.includes("ios")) return "mobile-first users";
  return "busy users who need a faster, clearer workflow";
}

function inferValueProps(text: string, projectName: string): string[] {
  const lower = text.toLowerCase();
  const props = new Set<string>();
  if (lower.includes("shift") || lower.includes("roster")) props.add("Creates and manages staff rosters faster");
  if (lower.includes("payroll")) props.add("Turns worked hours into payroll-ready reporting");
  if (lower.includes("restaurant")) props.add("Built for restaurant and hospitality operators");
  if (lower.includes("clock")) props.add("Supports staff clock-in and attendance workflows");
  if (lower.includes("local")) props.add("Runs locally and keeps workflow under user control");
  if (lower.includes("ai") || lower.includes("agent")) props.add("Uses AI to remove repetitive planning work");
  if (lower.includes("automation")) props.add("Automates manual steps without adding a heavy SaaS dependency");
  props.add(`${projectName} turns scattered project context into a clearer result`);
  return [...props].slice(0, 4);
}
