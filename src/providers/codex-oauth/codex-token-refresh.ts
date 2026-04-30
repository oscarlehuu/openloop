import { OpenLoopError } from "../../shared/errors.js";
import {
  CODEX_OAUTH_CLIENT_ID,
  CODEX_OAUTH_TOKEN_URL,
  TOKEN_REFRESH_SKEW_SECONDS
} from "./codex-constants.js";
import {
  CodexCredentials,
  requireCodexCredentials,
  saveCodexCredentials
} from "./codex-auth-store.js";
import { isJwtExpiring } from "./jwt-utils.js";

export async function resolveCodexAccessToken(): Promise<string> {
  const credentials = await requireCodexCredentials();
  if (!isJwtExpiring(credentials.accessToken, TOKEN_REFRESH_SKEW_SECONDS)) {
    return credentials.accessToken;
  }
  return (await refreshCodexCredentials(credentials)).accessToken;
}

export async function refreshCodexCredentials(
  credentials: CodexCredentials
): Promise<CodexCredentials> {
  if (!credentials.refreshToken) {
    throw new OpenLoopError(
      "Codex OAuth access token is expired and no refresh token is stored.",
      "CODEX_REFRESH_MISSING"
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: credentials.refreshToken,
    client_id: CODEX_OAUTH_CLIENT_ID
  });
  const response = await fetch(CODEX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    throw new OpenLoopError(
      `Codex OAuth refresh failed with HTTP ${response.status}.`,
      "CODEX_REFRESH_FAILED"
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const accessToken = stringValue(data.access_token);
  if (!accessToken) {
    throw new OpenLoopError("Codex OAuth refresh returned no access token.", "CODEX_REFRESH_FAILED");
  }
  const next: CodexCredentials = {
    ...credentials,
    accessToken,
    refreshToken: stringValue(data.refresh_token) ?? credentials.refreshToken,
    lastRefresh: new Date().toISOString()
  };
  await saveCodexCredentials(next);
  return next;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
