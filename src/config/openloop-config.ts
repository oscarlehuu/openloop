import { access } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../shared/json-file.js";

export const DEFAULT_OUTPUT_DIRECTORY = ".openloop/campaign";

export const DEFAULT_THEME = {
  brandName: "OpenLoop",
  fontFamily: "Arial, Helvetica, sans-serif",
  textColor: "#ffffff",
  accentColor: "#f8d34a",
  shadowColor: "rgba(0,0,0,0.42)"
};

export const DEFAULT_IMAGE_CONFIG = {
  model: "gpt-image-2",
  chatModel: "gpt-5.4",
  size: "1024x1536",
  quality: "medium" as const
};

export const slideThemeSchema = z.object({
  brandName: z.string(),
  fontFamily: z.string(),
  textColor: z.string(),
  accentColor: z.string(),
  shadowColor: z.string()
});

export const openLoopConfigSchema = z.object({
  schemaVersion: z.literal(1),
  defaultSlides: z.number().int().min(1).max(12).default(6),
  outputDirectory: z.string().default(DEFAULT_OUTPUT_DIRECTORY),
  imageProvider: z.literal("codex-oauth").default("codex-oauth"),
  image: z
    .object({
      model: z.string(),
      chatModel: z.string(),
      size: z.string(),
      quality: z.enum(["low", "medium", "high"])
    })
    .default(DEFAULT_IMAGE_CONFIG),
  theme: slideThemeSchema.default(DEFAULT_THEME)
});

export type OpenLoopConfig = z.infer<typeof openLoopConfigSchema>;
export type SlideTheme = z.infer<typeof slideThemeSchema>;

export const CONFIG_FILE_NAME = "openloop.config.json";

export function defaultConfig(): OpenLoopConfig {
  return openLoopConfigSchema.parse({ schemaVersion: 1 });
}

export function configPath(cwd = process.cwd()): string {
  return join(cwd, CONFIG_FILE_NAME);
}

export async function configExists(cwd = process.cwd()): Promise<boolean> {
  try {
    await access(configPath(cwd));
    return true;
  } catch {
    return false;
  }
}

export async function readConfig(cwd = process.cwd()): Promise<OpenLoopConfig> {
  return readJsonFile(configPath(cwd), openLoopConfigSchema);
}

export async function ensureConfig(cwd = process.cwd()): Promise<OpenLoopConfig> {
  if (await configExists(cwd)) {
    const config = await readConfig(cwd);
    if (config.outputDirectory === "runs") {
      const next = { ...config, outputDirectory: DEFAULT_OUTPUT_DIRECTORY };
      await writeJsonFile(configPath(cwd), next);
      return next;
    }
    return config;
  }
  const config = defaultConfig();
  await writeJsonFile(configPath(cwd), config);
  return config;
}
