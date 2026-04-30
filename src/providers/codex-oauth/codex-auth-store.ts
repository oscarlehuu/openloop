import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { readJsonFile, writePrivateJsonFile } from "../../shared/json-file.js";
import { OpenLoopError } from "../../shared/errors.js";

export const codexCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  baseUrl: z.string().url(),
  lastRefresh: z.string(),
  authMode: z.literal("chatgpt")
});

const authStoreSchema = z.object({
  schemaVersion: z.literal(1),
  providers: z.object({
    codexOauth: codexCredentialsSchema.optional()
  })
});

export type CodexCredentials = z.infer<typeof codexCredentialsSchema>;
type AuthStore = z.infer<typeof authStoreSchema>;

export function openLoopHome(): string {
  return join(homedir(), ".openloop");
}

export function authStorePath(): string {
  return join(openLoopHome(), "auth.json");
}

export async function readCodexCredentials(): Promise<CodexCredentials | undefined> {
  try {
    const store = await readJsonFile(authStorePath(), authStoreSchema);
    return store.providers.codexOauth;
  } catch {
    return undefined;
  }
}

export async function saveCodexCredentials(credentials: CodexCredentials): Promise<void> {
  await mkdir(openLoopHome(), { recursive: true });
  const store: AuthStore = {
    schemaVersion: 1,
    providers: { codexOauth: credentials }
  };
  await writePrivateJsonFile(authStorePath(), store);
}

export async function clearCodexCredentials(): Promise<boolean> {
  try {
    await rm(authStorePath());
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function requireCodexCredentials(): Promise<CodexCredentials> {
  const credentials = await readCodexCredentials();
  if (!credentials) {
    throw new OpenLoopError(
      "Codex OAuth credentials are missing.",
      "CODEX_AUTH_MISSING",
      "Run: npm run openloop -- auth:login codex"
    );
  }
  return credentials;
}

export async function importCodexCliCredentials(): Promise<CodexCredentials> {
  const raw = await readJsonFile(join(homedir(), ".codex", "auth.json"), z.record(z.string(), z.unknown()));
  const source = (raw.tokens ?? raw) as Record<string, unknown>;
  const accessToken = stringField(source, "access_token") ?? stringField(source, "accessToken");
  const refreshToken = stringField(source, "refresh_token") ?? stringField(source, "refreshToken");
  if (!accessToken) {
    throw new OpenLoopError("Codex CLI auth file has no access token.", "CODEX_IMPORT_FAILED");
  }
  const credentials: CodexCredentials = {
    accessToken,
    refreshToken,
    baseUrl: "https://chatgpt.com/backend-api/codex",
    lastRefresh: new Date().toISOString(),
    authMode: "chatgpt"
  };
  await saveCodexCredentials(credentials);
  return credentials;
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value ? value : undefined;
}
