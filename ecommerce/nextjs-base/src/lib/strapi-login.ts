function getStrapiUrl() {
  const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL;
  if (!strapiUrl) throw new Error("NEXT_PUBLIC_STRAPI_URL manquante");

  return strapiUrl;
}

export type StrapiUser = {
  id: number;
  email: string;
  username: string;
};

export async function getStrapiUserFromJwt(jwt: string) {
  const strapiUrl = getStrapiUrl();

  const res = await fetch(`${strapiUrl}/api/users/me`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  return (await res.json()) as StrapiUser;
}
