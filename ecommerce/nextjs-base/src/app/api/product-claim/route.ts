import { NextRequest, NextResponse } from "next/server";
import { getCurrentStrapiUser } from "@/lib/strapi-session-cookie";
import { isAdminUser } from "@/lib/is-admin-user";
import { verifyProductClaimCode } from "@/lib/product-claim-code";

function toJsonHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function POST(req: NextRequest) {
  const strapiUser = await getCurrentStrapiUser();
  if (!strapiUser) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (isAdminUser(strapiUser)) {
    return NextResponse.json(
      {
        error:
          "Compte admin détecté. Le claim doit être fait avec le compte client final.",
        code: "admin_not_allowed",
      },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();

  if (!code) {
    return NextResponse.json({ error: "code requis" }, { status: 400 });
  }

  let productRecordDocumentId: string | null = null;
  let productRecordId: number | null = null;

  try {
    const verifiedCode = verifyProductClaimCode(code);
    if (!verifiedCode.ok) {
      return NextResponse.json(
        { error: "Code d activation produit invalide.", code: "invalid_code" },
        { status: 400 }
      );
    }

    if (verifiedCode.productRecordDocumentId) {
      productRecordDocumentId = verifiedCode.productRecordDocumentId;
    }
    if (verifiedCode.productRecordId) {
      productRecordId = verifiedCode.productRecordId;
    }
  } catch {
    return NextResponse.json(
      { error: "Configuration claim indisponible" },
      { status: 503 }
    );
  }

  if (!productRecordDocumentId && !productRecordId) {
    return NextResponse.json(
      { error: "Code d activation produit invalide.", code: "invalid_code" },
      { status: 400 }
    );
  }

  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  const apiToken =
    process.env.STRAPI_WRITE_API_TOKEN || process.env.STRAPI_API_TOKEN;
  const assignSecret = process.env.CLAIM_ASSIGN_SECRET;

  if (!strapiUrl || !apiToken || !assignSecret) {
    return NextResponse.json(
      { error: "Configuration serveur manquante" },
      { status: 500 }
    );
  }

  const response = await fetch(`${strapiUrl}/api/product-records/assign-owner`, {
    method: "POST",
    headers: {
      ...toJsonHeaders(apiToken),
      "x-claim-assign-secret": assignSecret,
    },
    body: JSON.stringify({
      productRecordDocumentId,
      productRecordId,
      ownerId: strapiUser.id,
      force: false,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "Strapi indisponible" }, { status: 503 });
  }

  const json = (await response.json().catch(() => null)) as {
    success?: boolean;
    reason?: string;
    productRecordDocumentId?: string;
  } | null;

  if (!response.ok) {
    if (response.status === 403) {
      return NextResponse.json(
        {
          error:
            "Accès Strapi refusé. Vérifiez STRAPI_WRITE_API_TOKEN et les droits de ce token.",
          code: "strapi_forbidden",
        },
        { status: 403 }
      );
    }

    if (response.status === 401) {
      return NextResponse.json(
        {
          error:
            "Authentification Strapi invalide. Vérifiez STRAPI_WRITE_API_TOKEN et CLAIM_ASSIGN_SECRET.",
          code: "strapi_unauthorized",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Erreur Strapi" },
      { status: response.status }
    );
  }

  if (!json?.success) {
    if (json?.reason === "already_assigned") {
      return NextResponse.json(
        {
          error: "Ce produit est déjà associé à un autre compte.",
          code: "already_assigned",
        },
        { status: 409 }
      );
    }

    if (json?.reason === "product_record_not_found") {
      return NextResponse.json(
        {
          error: "Dossier produit introuvable.",
          code: "product_record_not_found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Association impossible pour le moment.",
        code: json?.reason ?? "claim_failed",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    productRecordDocumentId: json.productRecordDocumentId ?? productRecordDocumentId,
  });
}
