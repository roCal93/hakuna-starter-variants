import { redirect } from "next/navigation";

export default async function ActivationEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { locale } = await params;
  const { code } = await searchParams;

  const target = code
    ? `/${locale}/espace-client/activation?code=${encodeURIComponent(code)}`
    : `/${locale}/espace-client/activation`;

  redirect(target);
}
