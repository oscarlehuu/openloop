import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CampaignIdea, SlidesDocument } from "../campaign/slide-schema.js";

export async function writeCaption(options: {
  runPath: string;
  idea: CampaignIdea;
  slidesDocument: SlidesDocument;
  outputPath?: string;
}): Promise<string> {
  const caption = [
    options.idea.caption,
    "",
    options.slidesDocument.slides
      .map((slide) => `${slide.slideNumber}. ${slide.overlayText?.headline ?? slide.role}`)
      .join("\n"),
    "",
    "#buildinpublic #marketing #startup"
  ].join("\n");
  const outputPath = join(options.runPath, options.outputPath ?? "modules/social-slides/export/caption.txt");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, caption, "utf8");
  return outputPath;
}
