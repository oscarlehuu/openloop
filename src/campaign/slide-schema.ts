import { z } from "zod";
import { projectBriefSchema } from "../scanner/project-scanner.js";

export const campaignIdeaSchema = z.object({
  schemaVersion: z.literal(1),
  angle: z.string(),
  audience: z.string(),
  pain: z.string(),
  promise: z.string(),
  cta: z.string(),
  caption: z.string()
});

export const slideOverlayTextSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string(),
  subtitle: z.string().optional(),
  cta: z.string().optional()
});

export const slideSchema = z.object({
  slideNumber: z.number().int().min(1),
  role: z.string().min(1),
  overlayText: slideOverlayTextSchema.optional(),
  imagePrompt: z.string(),
  sourceImagePath: z.string().optional(),
  captionNotes: z.string(),
  visualContinuity: z.string()
});

export const slidesDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  brief: projectBriefSchema,
  slides: z.array(slideSchema).min(1).max(12)
});

export type CampaignIdea = z.infer<typeof campaignIdeaSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type SlidesDocument = z.infer<typeof slidesDocumentSchema>;
