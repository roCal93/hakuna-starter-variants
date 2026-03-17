import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all request paths except for Next.js internals, API routes, and static files
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
