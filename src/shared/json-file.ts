import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { OpenLoopError, toErrorMessage } from "./errors.js";

export async function readJsonFile<T>(
  filePath: string,
  schema: z.ZodType<T>
): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return schema.parse(JSON.parse(content));
  } catch (error) {
    throw new OpenLoopError(
      `Could not read valid JSON: ${filePath}`,
      "JSON_READ_FAILED",
      toErrorMessage(error)
    );
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(filePath, body, "utf8");
}

export async function writePrivateJsonFile(
  filePath: string,
  value: unknown
): Promise<void> {
  await writeJsonFile(filePath, value);
  try {
    await import("node:fs/promises").then((fs) => fs.chmod(filePath, 0o600));
  } catch {
    // Best effort on non-POSIX filesystems.
  }
}
