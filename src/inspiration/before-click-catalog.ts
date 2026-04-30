import { runInNewContext } from "node:vm";
import { z } from "zod";

export const BEFORE_CLICK_ORIGIN = "https://www.before.click";

export const beforeClickAppSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  category: z.string(),
  designStyles: z.array(z.string()).default([]),
  description: z.string().default(""),
  appStoreId: z.union([z.string(), z.number()]).optional(),
  accentColor: z.string().optional(),
  screenshots: z.array(z.string()).default([])
});

export type BeforeClickApp = z.infer<typeof beforeClickAppSchema>;

export async function fetchBeforeClickCatalog(): Promise<BeforeClickApp[]> {
  const homepage = await fetchText(BEFORE_CLICK_ORIGIN);
  const chunkPaths = extractChunkPaths(homepage);
  const chunks: string[] = [];
  for (const path of chunkPaths) {
    const chunk = await fetchText(`${BEFORE_CLICK_ORIGIN}${path}`);
    if (chunk.includes('"apps",0,')) chunks.push(chunk);
  }
  const catalog = extractBeforeClickCatalogFromChunks(chunks);
  if (!catalog.length) throw new Error("No before.click app catalog found.");
  return catalog;
}

export function extractBeforeClickCatalogFromChunks(chunks: string[]): BeforeClickApp[] {
  for (const chunk of chunks) {
    const markerIndex = chunk.indexOf('"apps",0,');
    if (markerIndex < 0) continue;
    const literal = extractArrayLiteral(chunk, markerIndex + '"apps",0,'.length);
    const parsed = runInNewContext(`(${literal})`, Object.create(null), { timeout: 100 }) as unknown;
    return z.array(beforeClickAppSchema).parse(parsed);
  }
  return [];
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.text();
}

function extractChunkPaths(html: string): string[] {
  const matches = html.matchAll(/\/_next\/static\/chunks\/[^"'<]+?\.js(?:\?[^"'<\\]*)?/g);
  return [...new Set([...matches].map((match) => match[0].replace(/&amp;/g, "&")))];
}

function extractArrayLiteral(source: string, fromIndex: number): string {
  const start = source.indexOf("[", fromIndex);
  if (start < 0) throw new Error("before.click app array start not found.");
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("before.click app array end not found.");
}
