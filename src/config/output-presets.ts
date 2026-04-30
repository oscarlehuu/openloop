import { OpenLoopError } from "../shared/errors.js";

export type OutputPreset = {
  label: string;
  aspect: string;
  width: number;
  height: number;
  exportDir?: string;
};

export const DEFAULT_OUTPUT_PRESET: OutputPreset = {
  label: "portrait",
  aspect: "2:3",
  width: 1024,
  height: 1536
};

const OUTPUT_PRESETS: Record<string, OutputPreset> = {
  portrait: DEFAULT_OUTPUT_PRESET,
  tiktok: { label: "tiktok", aspect: "9:16", width: 1080, height: 1920 },
  "instagram-reel": { label: "instagram-reel", aspect: "9:16", width: 1080, height: 1920 },
  "instagram-story": { label: "instagram-story", aspect: "9:16", width: 1080, height: 1920 },
  "instagram-post": { label: "instagram-post", aspect: "4:5", width: 1080, height: 1350 },
  square: { label: "square", aspect: "1:1", width: 1080, height: 1080 },
  "storyboard-2-3": { label: "storyboard-2-3", aspect: "2:3", width: 1024, height: 1536 },
  "storyboard-16-9": { label: "storyboard-16-9", aspect: "16:9", width: 1920, height: 1080 },
  "app-store-iphone-6-9": {
    label: "app-store-iphone-6-9",
    aspect: "6.9-inch",
    width: 1320,
    height: 2868,
    exportDir: "exports/app-store/iphone-6-9"
  },
  "app-store-iphone-6-5": {
    label: "app-store-iphone-6-5",
    aspect: "6.5-inch",
    width: 1284,
    height: 2778,
    exportDir: "exports/app-store/iphone-6-5"
  },
  "app-store-ipad-13": {
    label: "app-store-ipad-13",
    aspect: "13-inch",
    width: 2064,
    height: 2752,
    exportDir: "exports/app-store/ipad-13"
  },
  "app-store-ipad-12-9": {
    label: "app-store-ipad-12-9",
    aspect: "12.9-inch",
    width: 2048,
    height: 2732,
    exportDir: "exports/app-store/ipad-12-9"
  }
};

export function resolveOutputPreset(platform?: string, aspect?: string, defaultPlatform = "portrait"): OutputPreset {
  if (aspect) return presetFromAspect(aspect);
  const selectedPlatform = platform ?? defaultPlatform;
  if (!selectedPlatform) return DEFAULT_OUTPUT_PRESET;
  const preset = OUTPUT_PRESETS[selectedPlatform];
  if (!preset) {
    throw new OpenLoopError(
      `Unsupported platform: ${selectedPlatform}`,
      "UNSUPPORTED_PLATFORM",
      `Use one of: ${Object.keys(OUTPUT_PRESETS).join(", ")}`
    );
  }
  return preset;
}

function presetFromAspect(aspect: string): OutputPreset {
  const match = /^(\d+):(\d+)$/.exec(aspect.trim());
  if (!match) {
    throw new OpenLoopError("Aspect must use WIDTH:HEIGHT format, for example 9:16.", "INVALID_ASPECT");
  }
  const widthRatio = Number(match[1]);
  const heightRatio = Number(match[2]);
  if (!Number.isFinite(widthRatio) || !Number.isFinite(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    throw new OpenLoopError("Aspect ratio values must be positive numbers.", "INVALID_ASPECT");
  }
  const width = 1080;
  const height = Math.round((width * heightRatio) / widthRatio);
  return {
    label: `aspect-${widthRatio}-${heightRatio}`,
    aspect: `${widthRatio}:${heightRatio}`,
    width,
    height
  };
}
