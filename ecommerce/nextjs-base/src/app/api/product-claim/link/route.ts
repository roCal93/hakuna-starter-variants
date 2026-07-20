import { NextRequest, NextResponse } from "next/server";
import { getCurrentStrapiUser } from "@/lib/strapi-session-cookie";
import { isAdminUser } from "@/lib/is-admin-user";
import {
  createProductClaimCode,
  createProductClaimShortCode,
} from "@/lib/product-claim-code";
import { buildProductClaimUrl } from "@/lib/product-claim-url";
import { formatProductClaimCodeForDisplay } from "@/lib/product-claim-code-format";

export async function GET(req: NextRequest) {
  const strapiUser = await getCurrentStrapiUser();
  if (!strapiUser) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!isAdminUser(strapiUser)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const productRecordDocumentId =
    req.nextUrl.searchParams.get("productRecordDocumentId")?.trim() ?? "";
  const productRecordIdRaw =
    req.nextUrl.searchParams.get("productRecordId")?.trim() ?? "";
  const productRecordId = Number.parseInt(productRecordIdRaw, 10);

  if (!productRecordDocumentId && !Number.isInteger(productRecordId)) {
    return NextResponse.json(
      { error: "productRecordDocumentId ou productRecordId requis" },
      { status: 400 }
    );
  }

  try {
    const code = Number.isInteger(productRecordId)
      ? createProductClaimShortCode(productRecordId)
      : createProductClaimCode(productRecordDocumentId);

    const claimUrl = buildProductClaimUrl({
      productRecordDocumentId,
      productRecordId: Number.isInteger(productRecordId)
        ? productRecordId
        : undefined,
    });

    return NextResponse.json({
      success: true,
      code,
      codeDisplay: formatProductClaimCodeForDisplay(code),
      claimUrl,
      qrHint:
        "Installez la dépendance qrcode dans le projet client pour générer un PNG QR serveur si nécessaire.",
    });
  } catch {
    return NextResponse.json(
      { error: "Configuration serveur manquante pour générer le lien" },
      { status: 500 }
    );
  }
}
