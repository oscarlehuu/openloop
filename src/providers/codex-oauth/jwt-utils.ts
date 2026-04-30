export interface JwtClaims {
  exp?: number;
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string;
  };
}

export function decodeJwtClaims(token: string): JwtClaims | undefined {
  const parts = token.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payload = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return undefined;
  }
}

export function isJwtExpiring(token: string, skewSeconds: number): boolean {
  const exp = decodeJwtClaims(token)?.exp;
  if (!exp) return true;
  return exp - Math.floor(Date.now() / 1000) <= skewSeconds;
}

export function chatGptAccountId(token: string): string | undefined {
  return decodeJwtClaims(token)?.["https://api.openai.com/auth"]?.chatgpt_account_id;
}
