import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { dirname as posixDirname } from "node:path/posix";
import sharp from "sharp";

type ContactSheetApp = {
  downloadedScreenshots: Array<{ path: string }>;
};

const THUMB_WIDTH = 180;
const THUMB_HEIGHT = 390;
const GAP = 16;

export async function buildReferenceContactSheets(
  runPath: string,
  apps: ContactSheetApp[],
  maxSheets: number
): Promise<string[]> {
  const contactSheets: string[] = [];
  for (const app of apps) {
    if (contactSheets.length >= maxSheets) break;
    const sheet = await buildAppContactSheet(runPath, app);
    if (sheet) contactSheets.push(sheet);
  }
  return contactSheets;
}

async function buildAppContactSheet(runPath: string, app: ContactSheetApp): Promise<string | undefined> {
  const screenshots = app.downloadedScreenshots.filter((screenshot) => !screenshot.path.endsWith(".mp4"));
  if (!screenshots.length) return undefined;

  const outputRelativePath = `${posixDirname(screenshots[0].path)}/contact-sheet.png`;
  const outputPath = join(runPath, outputRelativePath);
  await mkdir(dirname(outputPath), { recursive: true });

  const columns = Math.min(3, screenshots.length);
  const rows = Math.ceil(screenshots.length / columns);
  const width = columns * THUMB_WIDTH + (columns + 1) * GAP;
  const height = rows * THUMB_HEIGHT + (rows + 1) * GAP;

  const thumbs = await Promise.all(
    screenshots.map((screenshot) =>
      sharp(join(runPath, screenshot.path))
        .resize({ width: THUMB_WIDTH, height: THUMB_HEIGHT, fit: "contain", background: "#f8fafc" })
        .png()
        .toBuffer()
    )
  );
  const composite = thumbs.map((input, index) => ({
    input,
    left: GAP + (index % columns) * (THUMB_WIDTH + GAP),
    top: GAP + Math.floor(index / columns) * (THUMB_HEIGHT + GAP)
  }));

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f8fafc"
    }
  })
    .composite(composite)
    .png()
    .toFile(outputPath);
  return outputRelativePath;
}
