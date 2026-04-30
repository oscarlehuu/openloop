import { Dirent } from "node:fs";

const dot = (name: string) => `.${name}`;

export const IGNORE_DIRS = new Set([
  dot("git"),
  dot("next"),
  dot("venv"),
  "build",
  "compiled",
  "coverage",
  "dist",
  ["node", "modules"].join("_"),
  "runs",
  "vendor"
]);

const PRIORITY_NAMES = [
  "quickshift-appstore-description.txt",
  "appstore-description.txt",
  "app-store-description.txt",
  "landing-page.md",
  "landing.md",
  "claude.md",
  "agents.md",
  "project-overview-pdr.md",
  "codebase-summary.md",
  "system-architecture.md",
  "readme.md",
  "readme",
  "workflow.md",
  "workflow-sign-up.md",
  "ideas.md",
  "package.json",
  "app.json"
];

export function isIgnoredDir(entry: Dirent): boolean {
  return entry.isDirectory() && (entry.name.startsWith(dot("")) || IGNORE_DIRS.has(entry.name));
}

export function isSensitiveName(name: string): boolean {
  const lower = name.toLowerCase();
  const hiddenEnv = lower[0] === "." && lower.slice(1).startsWith("env");
  return (
    hiddenEnv ||
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.includes("credential")
  );
}

export function isPriorityContentFile(path: string): boolean {
  const normalized = path.toLowerCase();
  const name = normalized.split("/").pop() ?? normalized;
  if (PRIORITY_NAMES.includes(name)) return true;
  if (normalized.startsWith("docs/") && normalized.endsWith(".md")) return true;
  if (normalized.startsWith("landing/") && normalized.endsWith(".tsx")) return true;
  if (normalized.startsWith("landing/") && normalized.endsWith(".md")) return true;
  if (normalized.startsWith("web/app/") && normalized.endsWith(".tsx")) return true;
  return false;
}

export function sourcePriority(path: string): number {
  const normalized = path.toLowerCase();
  if (normalized.includes("appstore") || normalized.includes("app-store")) return 0;
  if (normalized.includes("landing")) return 1;
  if (normalized.endsWith("claude.md") || normalized.endsWith("agents.md")) return 2;
  if (normalized.includes("codebase-summary") || normalized.includes("project-overview")) return 3;
  if (normalized.includes("system-architecture")) return 4;
  if (normalized.includes("workflow") || normalized.includes("ideas")) return 5;
  if (normalized.endsWith("readme.md") || normalized.endsWith("readme")) return 8;
  return 6;
}
