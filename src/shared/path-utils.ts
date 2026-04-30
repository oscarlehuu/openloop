import { resolve } from "node:path";

export function resolveFromCwd(pathLike: string, cwd = process.cwd()): string {
  return resolve(cwd, pathLike);
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "campaign";
}

export function timestampSlug(now = new Date()): string {
  const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  return iso.replace(/[-:]/g, "").replace("T", "-").replace("Z", "");
}
