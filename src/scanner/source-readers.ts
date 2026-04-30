import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { collectCodeSignals } from "./code-signal-reader.js";
import { isIgnoredDir, isPriorityContentFile, isSensitiveName, sourcePriority } from "./source-priorities.js";

export interface SourceSnippet {
  path: string;
  content: string;
}

export async function readSafeProjectSources(
  projectPath: string,
  maxCharsPerFile = 6000
): Promise<SourceSnippet[]> {
  const snippets: SourceSnippet[] = [];
  const files = await collectPriorityFiles(projectPath);
  for (const file of files.slice(0, 18)) {
    snippets.push({
      path: file,
      content: (await readFile(join(projectPath, file), "utf8")).slice(0, maxCharsPerFile)
    });
  }
  const codeSignals = await collectCodeSignals(projectPath);
  if (codeSignals) snippets.push({ path: "code-signals.txt", content: codeSignals });
  return snippets;
}

async function collectPriorityFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];
  await walk(projectPath, projectPath, files, 0);
  return files.sort((a, b) => sourcePriority(a) - sourcePriority(b) || a.localeCompare(b));
}

async function walk(root: string, dir: string, files: string[], depth: number): Promise<void> {
  if (depth > 4) return;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (isSensitiveName(entry.name) || isIgnoredDir(entry)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, fullPath, files, depth + 1);
      continue;
    }
    const rel = relative(root, fullPath);
    if (entry.isFile() && isPriorityContentFile(rel) && (await isSmallTextFile(fullPath))) files.push(rel);
  }
}

async function isSmallTextFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size <= 160_000;
  } catch {
    return false;
  }
}
