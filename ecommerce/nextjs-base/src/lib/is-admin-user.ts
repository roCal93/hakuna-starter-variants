import type { StrapiUser } from "@/lib/strapi-login";

export function isAdminUser(user: StrapiUser | null): boolean {
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return user.email.toLowerCase() === adminEmail.toLowerCase();
}
