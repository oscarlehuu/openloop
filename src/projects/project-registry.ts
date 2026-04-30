import { access, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { z } from "zod";
import { OpenLoopError, toErrorMessage } from "../shared/errors.js";
import { writeJsonFile } from "../shared/json-file.js";
import { slugify } from "../shared/path-utils.js";

export const PROJECT_REGISTRY_FILE_NAME = "openloop.projects.json";

export const projectEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  tags: z.array(z.string()).default([]),
  addedAt: z.string()
});

export const projectRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.array(projectEntrySchema)
});

export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type ProjectRegistry = z.infer<typeof projectRegistrySchema>;

export function projectRegistryPath(cwd = process.cwd()): string {
  return join(cwd, PROJECT_REGISTRY_FILE_NAME);
}

export async function readProjectRegistry(cwd = process.cwd()): Promise<ProjectRegistry> {
  const filePath = projectRegistryPath(cwd);
  try {
    await access(filePath);
  } catch {
    return { schemaVersion: 1, projects: [] };
  }

  try {
    return projectRegistrySchema.parse(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    throw new OpenLoopError(
      `Could not read valid project registry: ${filePath}`,
      "PROJECT_REGISTRY_READ_FAILED",
      toErrorMessage(error)
    );
  }
}

export async function writeProjectRegistry(
  registry: ProjectRegistry,
  cwd = process.cwd()
): Promise<void> {
  await writeJsonFile(projectRegistryPath(cwd), registry);
}

export async function upsertProject(options: {
  cwd?: string;
  projectPath: string;
  name?: string;
  tags?: string[];
}): Promise<{ project: ProjectEntry; created: boolean }> {
  const cwd = options.cwd ?? process.cwd();
  const registry = await readProjectRegistry(cwd);
  const absolutePath = resolve(cwd, options.projectPath);
  const existing = registry.projects.find((project) => project.path === absolutePath);
  const name = options.name?.trim() || basename(absolutePath);
  const tags = normalizeTags(options.tags ?? []);

  if (existing) {
    existing.name = name;
    existing.tags = tags;
    await writeProjectRegistry(registry, cwd);
    return { project: existing, created: false };
  }

  const project: ProjectEntry = {
    id: uniqueProjectId(name, registry.projects),
    name,
    path: absolutePath,
    tags,
    addedAt: new Date().toISOString()
  };
  registry.projects.push(project);
  await writeProjectRegistry(registry, cwd);
  return { project, created: true };
}

export async function removeProject(idOrPath: string, cwd = process.cwd()): Promise<boolean> {
  const registry = await readProjectRegistry(cwd);
  const absolutePath = resolve(cwd, idOrPath);
  const nextProjects = registry.projects.filter(
    (project) => project.id !== idOrPath && project.path !== absolutePath
  );
  if (nextProjects.length === registry.projects.length) return false;
  await writeProjectRegistry({ ...registry, projects: nextProjects }, cwd);
  return true;
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function uniqueProjectId(name: string, projects: ProjectEntry[]): string {
  const base = slugify(name);
  const existingIds = new Set(projects.map((project) => project.id));
  if (!existingIds.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const id = `${base}-${index}`;
    if (!existingIds.has(id)) return id;
  }
}
