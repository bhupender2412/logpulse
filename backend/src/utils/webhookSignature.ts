import crypto from "crypto";

// ==========================================================
// SIGNATURE PREFIX
// ==========================================================

const SIGNATURE_VERSION =
  "v1";

// ==========================================================
// GENERATE WEBHOOK SIGNATURE
//
// We sign:
//
// timestamp.payload
//
// Example:
//
// 1787410000.{"event":"payment.completed"}
//
// This is better than signing only the payload because
// the timestamp can later be used for replay-attack
// protection.
// ==========================================================

export function generateWebhookSignature(
  payload: string,
  signingSecret: string,
  timestamp: string
): string {
  if (!signingSecret) {
    throw new Error(
      "Webhook signing secret is required"
    );
  }

  if (!timestamp) {
    throw new Error(
      "Webhook timestamp is required"
    );
  }

  const signedPayload =
    `${timestamp}.${payload}`;

  const digest =
    crypto
      .createHmac(
        "sha256",
        signingSecret
      )
      .update(
        signedPayload,
        "utf8"
      )
      .digest(
        "hex"
      );

  return `${SIGNATURE_VERSION}=${digest}`;
}

// ==========================================================
// VERIFY WEBHOOK SIGNATURE
//
// Used by our local test receiver.
//
// Later this same algorithm can be shown to developers in
// documentation so their own apps can verify PulseEngine
// webhooks.
// ==========================================================

export function verifyWebhookSignature(
  payload: string,
  signingSecret: string,
  timestamp: string,
  receivedSignature: string
): boolean {
  try {
    const expectedSignature =
      generateWebhookSignature(
        payload,
        signingSecret,
        timestamp
      );

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        "utf8"
      );

    // timingSafeEqual requires equal-length buffers.
    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    );
  } catch {
    return false;
  }
}