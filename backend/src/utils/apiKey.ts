import crypto from "crypto";

// ==========================================================
// GENERATE API KEY
// ==========================================================

export function generateApiKey(): string {
  const randomPart =
    crypto
      .randomBytes(32)
      .toString("hex");

  return `lp_live_${randomPart}`;
}

// ==========================================================
// HASH API KEY
// ==========================================================

export function hashApiKey(
  apiKey: string
): string {
  return crypto
    .createHash("sha256")
    .update(apiKey)
    .digest("hex");
}

// ==========================================================
// LAST FOUR CHARACTERS
// ==========================================================

export function getApiKeyLast4(
  apiKey: string
): string {
  return apiKey.slice(-4);
}