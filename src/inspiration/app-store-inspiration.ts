import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ProjectBrief } from "../scanner/project-scanner.js";
import { readJsonFile, writeJsonFile } from "../shared/json-file.js";
import { campaignLayout } from "../runs/campaign-layout.js";
import { WorkflowDefinition } from "../workflows/workflow-definitions.js";
import { BEFORE_CLICK_ORIGIN, fetchBeforeClickCatalog } from "./before-click-catalog.js";
import { buildStyleBrief, downloadAppScreenshots, selectReferenceApps, selectedAppSchema } from "./before-click-matching.js";
import { buildReferenceContactSheets } from "./reference-contact-sheets.js";

const MAX_REFERENCE_APPS = 6;
const MAX_REFERENCE_CONTACT_SHEETS = 6;

const inspirationManifestSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.literal("before.click"),
  sourceUrl: z.string(),
  projectFingerprint: z.string(),
  createdAt: z.string(),
  selectedApps: z.array(selectedAppSchema)
});

export type AppStoreInspirationContext = {
  provider: "before.click";
  manifestPath: string;
  styleBriefPath: string;
  referenceImagePaths: string[];
  plannerContext: string;
};

type InspirationManifest = z.infer<typeof inspirationManifestSchema>;

export async function prepareAppStoreInspiration(options: {
  runPath: string;
  brief: ProjectBrief;
  workflow: WorkflowDefinition;
}): Promise<AppStoreInspirationContext | undefined> {
  if (options.workflow.id !== "app-store-screenshot") return undefined;
  const layout = campaignLayout(options.workflow);
  const manifestRelativePath = `${layout.beforeClickReferencesDir}/manifest.json`;
  const styleBriefRelativePath = `${layout.moduleMetaDir}/style-brief.json`;
  const manifestPath = join(options.runPath, manifestRelativePath);
  const styleBriefPath = join(options.runPath, styleBriefRelativePath);
  const fingerprint = projectFingerprint(options.brief);

  const existing = await readExistingManifest(manifestPath, fingerprint);
  if (existing) return contextFromManifest(options.runPath, existing, manifestRelativePath, styleBriefRelativePath);

  try {
    const catalog = await fetchBeforeClickCatalog();
    const selected = selectReferenceApps(catalog, options.brief).slice(0, MAX_REFERENCE_APPS);
    if (!selected.length) return undefined;
    await rm(join(options.runPath, layout.beforeClickReferencesDir), { recursive: true, force: true });
    await mkdir(join(options.runPath, layout.beforeClickReferencesDir), { recursive: true });
    const selectedApps = [];
    for (const app of selected) {
      const downloadedScreenshots = await downloadAppScreenshots(options.runPath, layout.beforeClickReferencesDir, app);
      if (!downloadedScreenshots.length) continue;
      selectedApps.push({ ...app, downloadedScreenshots });
    }
    if (!selectedApps.length) return undefined;
    const manifest: InspirationManifest = {
      schemaVersion: 1,
      provider: "before.click",
      sourceUrl: BEFORE_CLICK_ORIGIN,
      projectFingerprint: fingerprint,
      createdAt: new Date().toISOString(),
      selectedApps
    };
    await writeJsonFile(manifestPath, manifest);
    await writeJsonFile(styleBriefPath, buildStyleBrief(options.brief, manifest));
    console.log(`App Store inspiration written: ${manifestPath}`);
    return contextFromManifest(options.runPath, manifest, manifestRelativePath, styleBriefRelativePath);
  } catch (error) {
    console.warn(`App Store inspiration skipped: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export async function appStoreInspirationReferenceImages(
  runPath: string,
  workflow: WorkflowDefinition
): Promise<string[]> {
  if (workflow.id !== "app-store-screenshot") return [];
  const manifestPath = join(runPath, campaignLayout(workflow).beforeClickReferencesDir, "manifest.json");
  try {
    const manifest = await readJsonFile(manifestPath, inspirationManifestSchema);
    return (await buildReferenceContactSheets(runPath, manifest.selectedApps, MAX_REFERENCE_CONTACT_SHEETS)).map((path) =>
      join(runPath, path)
    );
  } catch {
    return [];
  }
}

async function readExistingManifest(path: string, fingerprint: string): Promise<InspirationManifest | undefined> {
  try {
    const manifest = await readJsonFile(path, inspirationManifestSchema);
    return manifest.projectFingerprint === fingerprint && manifest.selectedApps.length ? manifest : undefined;
  } catch {
    return undefined;
  }
}


async function contextFromManifest(
  runPath: string,
  manifest: InspirationManifest,
  manifestPath: string,
  styleBriefPath: string
): Promise<AppStoreInspirationContext> {
  const referenceImagePaths = await buildReferenceContactSheets(
    runPath,
    manifest.selectedApps,
    MAX_REFERENCE_CONTACT_SHEETS
  );
  const referenceSummary = manifest.selectedApps
    .slice(0, MAX_REFERENCE_CONTACT_SHEETS)
    .map((app, index) => {
      const contactSheet = referenceImagePaths[index] ? `; contact sheet ${referenceImagePaths[index]}` : "";
      return `${app.name} (${app.category}; ${app.designStyles.join(", ") || "no style tags"}): ${
        app.downloadedScreenshots.length
      } screenshots downloaded${contactSheet}; ${app.matchReason}`;
    })
    .join("\n");
  return {
    provider: "before.click",
    manifestPath,
    styleBriefPath,
    referenceImagePaths,
    plannerContext: [
      "App Store inspiration provider: before.click.",
      `Reference manifest: ${manifestPath}`,
      `Style brief: ${styleBriefPath}`,
      "Selected references:",
      referenceSummary,
      "Each contact sheet is built from the full downloaded screenshot set for that app.",
      "Use these references only for art direction. Do not copy brands, UI content, exact layouts, colors one-to-one, or text."
    ].join("\n")
  };
}

function projectFingerprint(brief: ProjectBrief): string {
  return `before-click-v5|${brief.projectName}|${brief.summary}|${brief.audience}|${brief.valueProps.join("|")}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 1000);
}
