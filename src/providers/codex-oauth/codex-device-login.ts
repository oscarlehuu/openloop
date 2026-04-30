import { OpenLoopError } from "../../shared/errors.js";
import {
  CODEX_BASE_URL,
  CODEX_DEVICE_REDIRECT_URI,
  CODEX_DEVICE_TOKEN_URL,
  CODEX_DEVICE_USER_CODE_URL,
  CODEX_DEVICE_VERIFICATION_URL,
  CODEX_OAUTH_CLIENT_ID,
  CODEX_OAUTH_TOKEN_URL
} from "./codex-constants.js";
import { CodexCredentials, saveCodexCredentials } from "./codex-auth-store.js";

export async function loginWithCodexDeviceCode(): Promise<CodexCredentials> {
  const device = await requestDeviceCode();
  console.log("Open this URL and enter the code:");
  console.log(`  ${CODEX_DEVICE_VERIFICATION_URL}`);
  console.log(`  Code: ${device.userCode}`);

  const authorized = await pollAuthorizationCode(device);
  const credentials = await exchangeAuthorizationCode(authorized);
  await saveCodexCredentials(credentials);
  return credentials;
}

async function requestDeviceCode(): Promise<{
  userCode: string;
  deviceAuthId: string;
  intervalSeconds: number;
}> {
  const response = await fetch(CODEX_DEVICE_USER_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CODEX_OAUTH_CLIENT_ID })
  });
  if (!response.ok) {
    throw new OpenLoopError(`Device code request failed: HTTP ${response.status}`, "CODEX_LOGIN_FAILED");
  }
  const data = (await response.json()) as Record<string, unknown>;
  const userCode = stringValue(data.user_code);
  const deviceAuthId = stringValue(data.device_auth_id);
  if (!userCode || !deviceAuthId) {
    throw new OpenLoopError("Device code response is missing fields.", "CODEX_LOGIN_FAILED");
  }
  return {
    userCode,
    deviceAuthId,
    intervalSeconds: Math.max(3, Number(data.interval ?? 5))
  };
}

async function pollAuthorizationCode(device: {
  userCode: string;
  deviceAuthId: string;
  intervalSeconds: number;
}): Promise<{ authorizationCode: string; codeVerifier: string }> {
  const startedAt = Date.now();
  const timeoutMs = 15 * 60 * 1000;
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, device.intervalSeconds * 1000));
    const response = await fetch(CODEX_DEVICE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_auth_id: device.deviceAuthId, user_code: device.userCode })
    });
    if (response.status === 403 || response.status === 404) continue;
    if (!response.ok) {
      throw new OpenLoopError(`Device auth polling failed: HTTP ${response.status}`, "CODEX_LOGIN_FAILED");
    }
    const data = (await response.json()) as Record<string, unknown>;
    const authorizationCode = stringValue(data.authorization_code);
    const codeVerifier = stringValue(data.code_verifier);
    if (!authorizationCode || !codeVerifier) {
      throw new OpenLoopError("Device auth response is missing exchange fields.", "CODEX_LOGIN_FAILED");
    }
    return { authorizationCode, codeVerifier };
  }
  throw new OpenLoopError("Codex device login timed out.", "CODEX_LOGIN_TIMEOUT");
}

async function exchangeAuthorizationCode(input: {
  authorizationCode: string;
  codeVerifier: string;
}): Promise<CodexCredentials> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.authorizationCode,
    redirect_uri: CODEX_DEVICE_REDIRECT_URI,
    client_id: CODEX_OAUTH_CLIENT_ID,
    code_verifier: input.codeVerifier
  });
  const response = await fetch(CODEX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    throw new OpenLoopError(`Token exchange failed: HTTP ${response.status}`, "CODEX_LOGIN_FAILED");
  }
  const data = (await response.json()) as Record<string, unknown>;
  const accessToken = stringValue(data.access_token);
  if (!accessToken) throw new OpenLoopError("Token exchange returned no access token.", "CODEX_LOGIN_FAILED");
  return {
    accessToken,
    refreshToken: stringValue(data.refresh_token),
    baseUrl: CODEX_BASE_URL,
    lastRefresh: new Date().toISOString(),
    authMode: "chatgpt"
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
