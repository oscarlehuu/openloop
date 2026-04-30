import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import { ProjectBrief } from "../scanner/project-scanner.js";
import { slugify } from "../shared/path-utils.js";
import { BEFORE_CLICK_ORIGIN, BeforeClickApp, beforeClickAppSchema } from "./before-click-catalog.js";

export const downloadedScreenshotSchema = z.object({
  url: z.string(),
  path: z.string()
});

export const selectedAppSchema = beforeClickAppSchema.extend({
  score: z.number(),
  matchReason: z.string(),
  downloadedScreenshots: z.array(downloadedScreenshotSchema)
});

export type ScoredBeforeClickApp = BeforeClickApp & { score: number; matchReason: string };

export function selectReferenceApps(apps: BeforeClickApp[], brief: ProjectBrief): ScoredBeforeClickApp[] {
  const words = keywordsForBrief(brief);
  const preferredCategories = categoryHints(brief);
  const preferredStyles = new Set(["minimal", "typography", "colorful", "gradient", "glassmorphism", "bold"]);
  const scored = apps
    .map((app) => {
      const haystack = `${app.name} ${app.category} ${app.description} ${app.designStyles.join(" ")}`.toLowerCase();
      const keywordHits = keywordHitCount(app, words);
      const categoryHit = preferredCategories.includes(app.category.toLowerCase()) ? 8 : 0;
      const matchingStyles = app.designStyles.filter((style) => preferredStyles.has(style));
      const styleScore = matchingStyles.length * 4;
      const score = categoryHit + Math.min(keywordHits, 4) * 1.5 + styleScore + Math.min(app.screenshots.length, 5) * 0.2;
      const matchReason = [
        categoryHit ? `category ${app.category}` : undefined,
        keywordHits ? `${keywordHits} product keyword hits` : undefined,
        matchingStyles.length ? `styles ${matchingStyles.join(", ")}` : undefined
      ]
        .filter(Boolean)
        .join("; ");
      return { ...app, score, matchReason: matchReason || "general high-quality App Store reference" };
    })
    .filter((app) => app.screenshots.length)
    .sort((a, b) => b.score - a.score);
  const categoryMatches = scored.filter((app) => preferredCategories.includes(app.category.toLowerCase()));
  if (categoryMatches.length >= 3) return categoryMatches;
  const keywordMatches = scored.filter(
    (app) => !preferredCategories.includes(app.category.toLowerCase()) && keywordHitCount(app, words) >= 5
  );
  return [...categoryMatches, ...keywordMatches].sort((a, b) => b.score - a.score);
}

export async function downloadAppScreenshots(
  runPath: string,
  referencesDir: string,
  app: BeforeClickApp
): Promise<Array<{ url: string; path: string }>> {
  const appDir = `${referencesDir}/${slugify(app.id || app.name)}`;
  await mkdir(join(runPath, appDir), { recursive: true });
  const downloaded: Array<{ url: string; path: string }> = [];
  const screenshots = app.screenshots.filter((path) => !path.endsWith(".mp4"));
  for (const [index, screenshot] of screenshots.entries()) {
    const url = absoluteBeforeClickUrl(screenshot);
    const extension = extensionForUrl(screenshot);
    const relativePath = `${appDir}/aso-${String(index + 1).padStart(2, "0")}${extension}`;
    const response = await fetch(url);
    if (!response.ok) continue;
    await writeFile(join(runPath, relativePath), Buffer.from(await response.arrayBuffer()));
    downloaded.push({ url, path: relativePath });
  }
  return downloaded;
}

export function buildStyleBrief(
  brief: ProjectBrief,
  manifest: {
    provider: string;
    sourceUrl: string;
    selectedApps: Array<z.infer<typeof selectedAppSchema>>;
  }
): Record<string, unknown> {
  const styleCounts = new Map<string, number>();
  for (const app of manifest.selectedApps) {
    for (const style of app.designStyles) styleCounts.set(style, (styleCounts.get(style) ?? 0) + 1);
  }
  const styles = [...styleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([style]) => style)
    .slice(0, 5);
  return {
    schemaVersion: 1,
    provider: manifest.provider,
    project: brief.projectName,
    sourceUrl: manifest.sourceUrl,
    visualDirection: styles.length ? styles.join(" + ") : "polished App Store screenshot design",
    selectedReferences: manifest.selectedApps.map((app) => ({
      name: app.name,
      category: app.category,
      designStyles: app.designStyles,
      accentColor: app.accentColor,
      reason: app.matchReason,
      screenshots: app.downloadedScreenshots.map((screenshot) => screenshot.path)
    })),
    rules: [
      "Analyze references as screenshot sets, not as a single isolated image.",
      "Use reference screenshots for art direction only.",
      "Preserve the real app screenshot as the only source of app UI.",
      "Do not copy reference app names, UI, brand colors exactly, text, logos, or layout one-to-one.",
      "Prefer short benefit-led local overlay copy and crop-safe negative space."
    ]
  };
}

function keywordsForBrief(brief: ProjectBrief): string[] {
  const text = `${brief.projectName} ${brief.summary} ${brief.audience} ${brief.valueProps.join(" ")}`.toLowerCase();
  const words = text.match(/[a-z][a-z0-9]{3,}/g) ?? [];
  return [...new Set(words)].filter((word) => !STOP_WORDS.has(word)).slice(0, 40);
}

function categoryHints(brief: ProjectBrief): string[] {
  const text = `${brief.summary} ${brief.audience} ${brief.valueProps.join(" ")}`.toLowerCase();
  const categories = new Set<string>();
  if (/(task|todo|calendar|schedule|workflow|team|project|productivity|staff|roster|shift)/.test(text)) categories.add("productivity");
  if (/(business|ops|operation|manager|restaurant|staff|shift|roster|payroll)/.test(text)) categories.add("business");
  if (/(restaurant|cafe|food|hospitality|venue)/.test(text)) categories.add("food & drink");
  if (/(money|bank|finance|payment|invoice|invest|spend|budget)/.test(text)) categories.add("finance");
  if (/(utility|tool|scanner|camera|ocr|device)/.test(text)) categories.add("utilities");
  if (!categories.size) categories.add("productivity");
  return [...categories];
}

function keywordHitCount(app: BeforeClickApp, words: string[]): number {
  const haystack = `${app.name} ${app.category} ${app.description} ${app.designStyles.join(" ")}`.toLowerCase();
  return words.filter((word) => haystack.includes(word)).length;
}

function absoluteBeforeClickUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${BEFORE_CLICK_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

function extensionForUrl(url: string): string {
  const base = basename(url.split("?")[0]);
  if (base.endsWith(".png") || base.endsWith(".jpg") || base.endsWith(".jpeg") || base.endsWith(".webp")) {
    return base.slice(base.lastIndexOf("."));
  }
  return ".webp";
}

const STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
  "their",
  "about",
  "which",
  "need",
  "needs",
  "product",
  "users",
  "user",
  "app",
  "apps",
  "mobile",
  "local",
  "workflow",
  "workflows"
]);
