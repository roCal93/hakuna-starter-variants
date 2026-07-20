import {
  createProductClaimCode,
  createProductClaimShortCode,
} from "@/lib/product-claim-code";

type ProductClaimTarget =
  | string
  | {
      productRecordDocumentId: string;
      productRecordId?: number;
    };

function getClaimBaseUrl() {
  const configuredBaseUrl =
    process.env.CLAIM_QR_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredBaseUrl) {
    throw new Error("CLAIM_QR_BASE_URL ou NEXT_PUBLIC_SITE_URL manquant");
  }

  return configuredBaseUrl.replace(/\/$/, "");
}

export function buildProductClaimUrl(target: ProductClaimTarget) {
  const productRecordDocumentId =
    typeof target === "string" ? target : target.productRecordDocumentId;
  const productRecordId =
    typeof target === "string" ? undefined : target.productRecordId;

  const code =
    typeof productRecordId === "number"
      ? createProductClaimShortCode(productRecordId)
      : createProductClaimCode(productRecordDocumentId);

  const baseUrl = getClaimBaseUrl();
  return `${baseUrl}/activation?code=${encodeURIComponent(code)}`;
}
