import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import OpenAI from "openai";
import { OpenLoopConfig } from "../../config/openloop-config.js";
import { OpenLoopError } from "../../shared/errors.js";
import { GenerateImageInput, ImageProvider } from "../image-provider.js";
import { codexHeaders } from "./codex-headers.js";
import { resolveCodexAccessToken } from "./codex-token-refresh.js";

export class CodexOAuthImageProvider implements ImageProvider {
  readonly name = "codex-oauth";

  constructor(private readonly config: OpenLoopConfig) {}

  async generateImage(input: GenerateImageInput): Promise<void> {
    const accessToken = await resolveCodexAccessToken();
    const client = new OpenAI({
      apiKey: accessToken,
      baseURL: "https://chatgpt.com/backend-api/codex",
      defaultHeaders: codexHeaders(accessToken)
    });
    const imageB64 = await collectImageBase64(client, {
      prompt: input.prompt,
      instructions: input.instructions,
      sourceImagePath: input.sourceImagePath,
      referenceImagePaths: input.referenceImagePaths,
      size: input.size,
      quality: input.quality,
      imageModel: this.config.image.model,
      chatModel: this.config.image.chatModel
    });
    if (!imageB64) {
      throw new OpenLoopError("Codex image generation returned no image.", "CODEX_IMAGE_EMPTY");
    }
    await mkdir(dirname(input.outputPath), { recursive: true });
    await writeFile(input.outputPath, Buffer.from(imageB64, "base64"));
  }
}

async function collectImageBase64(
  client: OpenAI,
  options: {
    prompt: string;
    instructions: string;
    sourceImagePath?: string;
    referenceImagePaths?: string[];
    size: string;
    quality: string;
    imageModel: string;
    chatModel: string;
  }
): Promise<string | undefined> {
  const content: unknown[] = [{ type: "input_text", text: options.prompt }];
  if (options.sourceImagePath) {
    content.push({ type: "input_image", image_url: await imageDataUrl(options.sourceImagePath) });
  }
  for (const referencePath of options.referenceImagePaths ?? []) {
    content.push({ type: "input_image", image_url: await imageDataUrl(referencePath) });
  }
  const payload = {
    model: options.chatModel,
    store: false,
    instructions: options.instructions,
    input: [
      {
        type: "message",
        role: "user",
        content
      }
    ],
    tools: [
      {
        type: "image_generation",
        model: options.imageModel,
        size: options.size,
        quality: options.quality,
        output_format: "png",
        background: "opaque",
        partial_images: 1
      }
    ],
    tool_choice: {
      type: "allowed_tools",
      mode: "required",
      tools: [{ type: "image_generation" }]
    }
  };

  const streamFactory = (client.responses as unknown as { stream?: (body: unknown) => AsyncIterable<unknown> }).stream;
  if (!streamFactory) return collectImageBase64FromCreate(client, payload);

  let imageB64: string | undefined;
  const stream = streamFactory.call(client.responses, payload);
  for await (const event of stream) {
    imageB64 = imageB64FromEvent(event) ?? imageB64;
  }
  const maybeFinal = stream as unknown as { finalResponse?: () => Promise<unknown> };
  if (maybeFinal.finalResponse) {
    imageB64 = imageB64FromResponse(await maybeFinal.finalResponse()) ?? imageB64;
  }
  return imageB64;
}

async function imageDataUrl(path: string): Promise<string> {
  const bytes = await readFile(path);
  return `data:${mimeTypeForPath(path)};base64,${bytes.toString("base64")}`;
}

function mimeTypeForPath(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function collectImageBase64FromCreate(client: OpenAI, payload: unknown): Promise<string | undefined> {
  const response = await (client.responses.create as unknown as (body: unknown) => Promise<unknown>)(payload);
  return imageB64FromResponse(response);
}

function imageB64FromEvent(event: unknown): string | undefined {
  const data = event as { type?: string; item?: unknown; partial_image_b64?: unknown };
  if (data.type === "response.image_generation_call.partial_image" && typeof data.partial_image_b64 === "string") {
    return data.partial_image_b64;
  }
  if (data.type === "response.output_item.done") return imageB64FromResponse({ output: [data.item] });
  return undefined;
}

function imageB64FromResponse(response: unknown): string | undefined {
  const output = (response as { output?: unknown[] }).output ?? [];
  for (const item of output) {
    const typed = item as { type?: string; result?: unknown };
    if (typed.type === "image_generation_call" && typeof typed.result === "string") return typed.result;
  }
  return undefined;
}
