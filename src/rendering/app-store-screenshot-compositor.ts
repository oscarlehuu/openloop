import sharp, { type OverlayOptions } from "sharp";
import { OutputPreset } from "../config/output-presets.js";

export async function buildAppStoreScreenshotComposites(
  sourceImagePath: string,
  output: Pick<OutputPreset, "width" | "height">
): Promise<OverlayOptions[]> {
  const metadata = await sharp(sourceImagePath).metadata();
  const sourceWidth = metadata.width ?? 390;
  const sourceHeight = metadata.height ?? 844;
  const sourceAspect = sourceWidth / sourceHeight;
  const frame = clamp(Math.round(output.width * 0.014), 16, 26);
  const maxShellWidth = output.width * 0.50;
  const maxShellHeight = output.height * 0.76;
  let contentWidth = Math.round(maxShellWidth - frame * 2);
  let contentHeight = Math.round(contentWidth / sourceAspect);

  if (contentHeight + frame * 2 > maxShellHeight) {
    contentHeight = Math.round(maxShellHeight - frame * 2);
    contentWidth = Math.round(contentHeight * sourceAspect);
  }

  const shellWidth = contentWidth + frame * 2;
  const shellHeight = contentHeight + frame * 2;
  const left = Math.round(output.width * 0.44);
  const top = Math.round(output.height * 0.2);
  const radius = clamp(Math.round(shellWidth * 0.19), 96, 142);
  const innerRadius = Math.max(72, radius - frame * 1.35);

  return [
    {
      input: phoneShellSvg(shellWidth, shellHeight, radius),
      left,
      top
    },
    {
      input: await roundedScreenshot(sourceImagePath, contentWidth, contentHeight, innerRadius),
      left: left + frame,
      top: top + frame
    }
  ];
}

async function roundedScreenshot(
  sourceImagePath: string,
  width: number,
  height: number,
  radius: number
): Promise<Buffer> {
  const mask = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/>
</svg>`);
  return sharp(sourceImagePath)
    .resize(width, height, { fit: "cover", position: "top" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function phoneShellSvg(width: number, height: number, radius: number): Buffer {
  const frame = clamp(Math.round(width * 0.038), 16, 26);
  const innerX = Math.round(frame * 0.72);
  const innerY = Math.round(frame * 0.72);
  const innerWidth = width - innerX * 2;
  const innerHeight = height - innerY * 2;
  const innerRadius = Math.max(72, radius - frame);
  const buttonWidth = Math.max(5, Math.round(frame * 0.42));
  const buttonRadius = Math.ceil(buttonWidth / 2);
  const actionTop = Math.round(height * 0.16);
  const volumeTop = Math.round(height * 0.23);
  const volumeHeight = Math.round(height * 0.075);
  const powerTop = Math.round(height * 0.25);
  const powerHeight = Math.round(height * 0.12);
  return Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="titanium" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="18%" stop-color="#9ca3af"/>
      <stop offset="48%" stop-color="#111827"/>
      <stop offset="78%" stop-color="#030712"/>
      <stop offset="100%" stop-color="#6b7280"/>
    </linearGradient>
    <linearGradient id="bezel" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111111"/>
      <stop offset="100%" stop-color="#020202"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" fill="url(#titanium)"/>
  <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="${innerRadius}" fill="url(#bezel)"/>
  <rect x="${Math.round(frame * 0.2)}" y="${actionTop}" width="${buttonWidth}" height="${Math.round(height * 0.048)}" rx="${buttonRadius}" fill="#111827"/>
  <rect x="${Math.round(frame * 0.2)}" y="${volumeTop}" width="${buttonWidth}" height="${volumeHeight}" rx="${buttonRadius}" fill="#111827"/>
  <rect x="${width - Math.round(frame * 0.2) - buttonWidth}" y="${powerTop}" width="${buttonWidth}" height="${powerHeight}" rx="${buttonRadius}" fill="#111827"/>
  <rect x="${Math.round(width * 0.08)}" y="${Math.round(frame * 0.55)}" width="${Math.round(width * 0.84)}" height="${Math.max(2, Math.round(frame * 0.22))}" rx="${Math.max(1, Math.round(frame * 0.11))}" fill="rgba(255,255,255,0.28)"/>
</svg>`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
