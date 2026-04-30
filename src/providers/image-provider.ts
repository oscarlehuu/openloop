import { Slide } from "../campaign/slide-schema.js";

export interface GenerateImageInput {
  slide: Slide;
  outputPath: string;
  prompt: string;
  instructions: string;
  sourceImagePath?: string;
  referenceImagePaths?: string[];
  size: string;
  quality: "low" | "medium" | "high";
}

export interface ImageProvider {
  name: string;
  generateImage(input: GenerateImageInput): Promise<void>;
}
