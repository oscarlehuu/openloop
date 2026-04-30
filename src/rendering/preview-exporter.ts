import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SlidesDocument } from "../campaign/slide-schema.js";

export async function writePreviewHtml(
  runPath: string,
  slidesDocument: SlidesDocument,
  options: { outputPath?: string; imageBasePath?: string } = {}
): Promise<string> {
  const imageBasePath = options.imageBasePath ?? "../export/slides";
  const items = slidesDocument.slides
    .map((slide) => {
      const id = String(slide.slideNumber).padStart(2, "0");
      const title = slide.overlayText?.headline ?? humanizeRole(slide.role);
      return `<figure><img src="${imageBasePath}/slide-${id}.png" alt="Slide ${id}"><figcaption>${escapeHtml(title)}</figcaption></figure>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenLoop Preview</title>
  <style>
    body{margin:0;background:#111;color:#f5f5f5;font-family:Arial,sans-serif}
    main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;padding:24px}
    figure{margin:0}
    img{width:100%;border-radius:8px;display:block}
    figcaption{font-size:14px;line-height:1.4;margin-top:10px;color:#d8d8d8}
  </style>
</head>
<body><main>${items}</main></body>
</html>`;
  const outputPath = join(runPath, options.outputPath ?? "modules/social-slides/review/preview.html");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
  return outputPath;
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function humanizeRole(role: string): string {
  return role
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
