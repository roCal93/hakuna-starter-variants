import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeProductClaimCodeInput } from "./product-claim-code-format";

const LEGACY_CODE_SIG_LENGTH = 8;
const SHORT_CODE_SIG_LENGTH = 6;
const SHORT_CODE_PREFIX = "p";

function getProductClaimCodeSecret() {
  const secret =
    process.env.PRODUCT_CLAIM_CODE_SECRET?.trim() ||
    process.env.CLAIM_QR_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("PRODUCT_CLAIM_CODE_SECRET manquant");
  }

  return secret;
}

function createCodeSignature(payload: string, secret: string, sigLength: number) {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, sigLength)
    .toLowerCase();
}

function signaturesMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export function createProductClaimCode(productRecordDocumentId: string) {
  const normalizedDocumentId = productRecordDocumentId.trim().toLowerCase();
  if (!normalizedDocumentId) {
    throw new Error("productRecordDocumentId requis");
  }

  const secret = getProductClaimCodeSecret();
  const signature = createCodeSignature(
    normalizedDocumentId,
    secret,
    LEGACY_CODE_SIG_LENGTH
  );
  return `${normalizedDocumentId}${signature}`;
}

export function createProductClaimShortCode(productRecordId: number) {
  if (!Number.isInteger(productRecordId) || productRecordId <= 0) {
    throw new Error("productRecordId invalide");
  }

  const payload = productRecordId.toString(36);
  const secret = getProductClaimCodeSecret();
  const signature = createCodeSignature(payload, secret, SHORT_CODE_SIG_LENGTH);
  return `${SHORT_CODE_PREFIX}${payload}${signature}`;
}

export function verifyProductClaimCode(code: string): {
  ok: boolean;
  productRecordDocumentId?: string;
  productRecordId?: number;
} {
  const normalizedCode = normalizeProductClaimCodeInput(code);

  if (
    normalizedCode.startsWith(SHORT_CODE_PREFIX) &&
    normalizedCode.length > SHORT_CODE_PREFIX.length + SHORT_CODE_SIG_LENGTH
  ) {
    const payloadAndSig = normalizedCode.slice(SHORT_CODE_PREFIX.length);
    const payload = payloadAndSig.slice(0, -SHORT_CODE_SIG_LENGTH);
    const providedSignature = payloadAndSig.slice(-SHORT_CODE_SIG_LENGTH);

    if (!/^[a-z0-9]+$/.test(payload)) {
      return { ok: false };
    }

    const productRecordId = Number.parseInt(payload, 36);
    if (!Number.isInteger(productRecordId) || productRecordId <= 0) {
      return { ok: false };
    }

    const secret = getProductClaimCodeSecret();
    const expectedSignature = createCodeSignature(
      payload,
      secret,
      SHORT_CODE_SIG_LENGTH
    );

    if (!signaturesMatch(providedSignature, expectedSignature)) {
      return { ok: false };
    }

    return { ok: true, productRecordId };
  }

  if (normalizedCode.length <= LEGACY_CODE_SIG_LENGTH) {
    return { ok: false };
  }

  const productRecordDocumentId = normalizedCode.slice(0, -LEGACY_CODE_SIG_LENGTH);
  const providedSignature = normalizedCode.slice(-LEGACY_CODE_SIG_LENGTH);
  if (!productRecordDocumentId || !providedSignature) {
    return { ok: false };
  }

  const secret = getProductClaimCodeSecret();
  const expectedSignature = createCodeSignature(
    productRecordDocumentId,
    secret,
    LEGACY_CODE_SIG_LENGTH
  );

  if (!signaturesMatch(providedSignature, expectedSignature)) {
    return { ok: false };
  }

  return { ok: true, productRecordDocumentId };
}
