import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { isIgnoredDir, isSensitiveName } from "./source-priorities.js";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".dart", ".swift"]);
const CODE_FILE_LIMIT = 80;
const SIGNAL_LIMIT = 220;

export async function collectCodeSignals(projectPath: string): Promise<string> {
  const files = await collectCodeFiles(projectPath);
  const signals: string[] = [];
  for (const file of files) {
    const content = await readFile(join(projectPath, file), "utf8");
    const extracted = extractSignals(content);
    if (!extracted.length) continue;
    signals.push(`[${file}]\n${extracted.join("\n")}`);
    if (signals.join("\n").length > 12000) break;
  }
  return signals.join("\n\n");
}

async function collectCodeFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  await walk(projectPath, projectPath, files, 0);
  return files.sort(scoreCodePath).slice(0, CODE_FILE_LIMIT);
}

async function walk(root: string, dir: string, files: string[], depth: number): Promise<void> {
  if (depth > 5 || files.length > CODE_FILE_LIMIT * 3) return;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (isSensitiveName(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry)) continue;
      await walk(root, fullPath, files, depth + 1);
      continue;
    }
    if (!entry.isFile() || !(await isSmallTextFile(fullPath))) continue;
    const rel = relative(root, fullPath);
    if (CODE_EXTENSIONS.has(extension(rel))) files.push(rel);
  }
}

async function isSmallTextFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size <= 120_000;
  } catch {
    return false;
  }
}

function extractSignals(content: string): string[] {
  const signals = new Set<string>();
  const symbolPatterns = [
    /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
    /\b(?:class|struct|enum)\s+([A-Za-z0-9_]+)/g,
    /\bdef\s+([A-Za-z0-9_]+)/g,
    /\b(?:const|let|final)\s+([A-Za-z0-9_]+)\s*=/g,
    /\b(?:class|Future|Widget)\s+([A-Za-z0-9_]+)\s*(?:extends|\()/g
  ];
  for (const pattern of symbolPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (signals.size >= SIGNAL_LIMIT) return [...signals];
      signals.add(`symbol: ${match[1]}`);
    }
  }
  const textPattern = /["'`]([^"'`\n]{18,120})["'`]/g;
  for (const match of content.matchAll(textPattern)) {
    if (signals.size >= SIGNAL_LIMIT) break;
    const value = match[1].trim();
    if (looksProductText(value)) signals.add(`text: ${value}`);
  }
  return [...signals];
}

function looksProductText(value: string): boolean {
  if (!/[a-zA-Z]/.test(value) || !/\s/.test(value)) return false;
  if (/^(http|https|\/|[A-Z_]+$)/.test(value)) return false;
  return /(staff|shift|roster|payroll|restaurant|team|schedule|owner|manager|billing|clock|invite|report|workflow|project|campaign|customer|user)/i.test(
    value
  );
}

function scoreCodePath(a: string, b: string): number {
  return codePathScore(a) - codePathScore(b) || a.localeCompare(b);
}

function codePathScore(path: string): number {
  const lower = path.toLowerCase();
  if (lower.includes("test") || lower.includes("spec")) return 8;
  if (lower.startsWith("landing/") || lower.includes("marketing")) return 0;
  if ((lower.startsWith("web/") || lower.startsWith("fe/")) && isCoreProductPath(lower)) return 1;
  if (lower.startsWith("web/app/") || lower.startsWith("web/features/") || lower.startsWith("fe/")) return 2;
  if (isCoreProductPath(lower)) return 3;
  if (isBusinessSupportPath(lower)) return 4;
  if (lower.includes("controller") || lower.includes("service")) return 5;
  return 6;
}

function isCoreProductPath(path: string): boolean {
  return /(clock|payroll|restaurant|roster|schedule|shift|staff|timesheet)/.test(path);
}

function isBusinessSupportPath(path: string): boolean {
  return /(award|billing)/.test(path);
}

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index) : "";
}
