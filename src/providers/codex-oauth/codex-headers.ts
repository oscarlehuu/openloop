import { chatGptAccountId } from "./jwt-utils.js";

export function codexHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "codex_cli_rs/0.0.0 (OpenLoop)",
    originator: "codex_cli_rs"
  };
  const accountId = chatGptAccountId(accessToken);
  if (accountId) headers["ChatGPT-Account-ID"] = accountId;
  return headers;
}
