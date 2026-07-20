import { getCurrentStrapiUser } from "@/lib/strapi-session-cookie";
import { isAdminUser } from "@/lib/is-admin-user";
import { ClaimPageClient } from "../claim/ClaimPageClient";

export default async function ActivationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;
  const strapiUser = await getCurrentStrapiUser();

  return (
    <ClaimPageClient
      locale={locale}
      code={code ?? ""}
      isAuthenticated={Boolean(strapiUser)}
      isAdmin={isAdminUser(strapiUser)}
    />
  );
}
