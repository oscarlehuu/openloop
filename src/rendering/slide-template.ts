import { Slide } from "../campaign/slide-schema.js";
import { SlideTheme } from "../config/openloop-config.js";
import { DEFAULT_OUTPUT_PRESET, OutputPreset } from "../config/output-presets.js";

export const SLIDE_WIDTH = 1024;
export const SLIDE_HEIGHT = 1536;

export function buildOverlaySvg(
  slide: Slide,
  theme: SlideTheme,
  output: Pick<OutputPreset, "width" | "height"> = DEFAULT_OUTPUT_PRESET,
  options: { compactTopLayout?: boolean } = {}
): Buffer {
  const overlayText = slide.overlayText ?? {
    headline: humanizeRole(slide.role)
  };
  const scaleX = output.width / SLIDE_WIDTH;
  const scaleY = output.height / SLIDE_HEIGHT;
  const fontScale = Math.min(scaleX, scaleY);
  const headlineSize = Math.round(
    (options.compactTopLayout ? Math.min(fontSizeFor(overlayText.headline), 58) : fontSizeFor(overlayText.headline)) *
      fontScale
  );
  const subtitleSize = Math.round((options.compactTopLayout ? 28 : 38) * fontScale);
  const eyebrowSize = Math.round(34 * fontScale);
  const textX = (options.compactTopLayout ? 64 : 96) * scaleX;
  const maxTextWidth = (options.compactTopLayout ? 330 : 780) * scaleX;
  const headlineLines = wrapText(overlayText.headline, headlineSize, maxTextWidth);
  const subtitleLines = wrapText(overlayText.subtitle ?? "", subtitleSize, maxTextWidth).slice(0, options.compactTopLayout ? 2 : 3);
  const headlineStartY = options.compactTopLayout
    ? 270 * scaleY
    : 800 * scaleY - headlineLines.length * headlineSize * 0.6;
  const subtitleStartY = headlineStartY + headlineLines.length * headlineSize * 1.08 + 38 * fontScale;
  const cta = overlayText.cta ? pill(overlayText.cta, 96 * scaleX, 1290 * scaleY, theme, fontScale) : "";
  const shade = options.compactTopLayout
    ? `<linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.48)"/>
      <stop offset="38%" stop-color="rgba(0,0,0,0.18)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.02)"/>
    </linearGradient>`
    : `<linearGradient id="shade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.10)"/>
      <stop offset="48%" stop-color="rgba(0,0,0,0.22)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.76)"/>
    </linearGradient>`;

  return Buffer.from(`
<svg width="${output.width}" height="${output.height}" viewBox="0 0 ${output.width} ${output.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${shade}
  </defs>
  <rect width="${output.width}" height="${output.height}" fill="url(#shade)"/>
  ${
    options.compactTopLayout
      ? ""
      : `<text x="${textX}" y="${140 * scaleY}" font-size="${eyebrowSize}" font-family="${escapeXml(theme.fontFamily)}" font-weight="700" fill="${escapeXml(theme.accentColor)}">${escapeXml(overlayText.eyebrow ?? "")}</text>`
  }
  ${textLines(headlineLines, textX, headlineStartY, headlineSize, theme.textColor, theme.fontFamily, 800)}
  ${textLines(subtitleLines, textX, subtitleStartY, subtitleSize, "rgba(255,255,255,0.86)", theme.fontFamily, 500)}
  ${cta}
</svg>`);
}

function textLines(
  lines: string[],
  x: number,
  y: number,
  size: number,
  fill: string,
  family: string,
  weight: number
): string {
  return lines
    .map((line, index) => {
      const yy = y + index * size * 1.12;
      return `<text x="${x}" y="${yy}" font-size="${size}" font-family="${escapeXml(family)}" font-weight="${weight}" fill="${escapeXml(fill)}">${escapeXml(line)}</text>`;
    })
    .join("\n");
}

function pill(text: string, x: number, y: number, theme: SlideTheme, scale = 1): string {
  const width = Math.min(820 * scale, Math.max(380 * scale, text.length * 18 * scale + 72 * scale));
  const height = 86 * scale;
  const radius = 43 * scale;
  const textSize = 34 * scale;
  return `
  <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${escapeXml(theme.accentColor)}"/>
  <text x="${x + 36 * scale}" y="${y + 56 * scale}" font-size="${textSize}" font-family="${escapeXml(theme.fontFamily)}" font-weight="800" fill="#111111">${escapeXml(text)}</text>`;
}

function fontSizeFor(text: string): number {
  if (text.length < 42) return 76;
  if (text.length < 72) return 64;
  return 54;
}

function wrapText(text: string, fontSize: number, maxPixels: number): string[] {
  if (!text.trim()) return [];
  const maxChars = Math.max(10, Math.floor(maxPixels / (fontSize * 0.55)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanizeRole(role: string): string {
  return role
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
