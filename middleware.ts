import { NextResponse, type NextRequest } from "next/server";

/** Guard session di level edge: hanya cek keberadaan cookie.
 *  Validasi token (cek DB, expired, revoked) dilakukan di Server Component / Route Handler
 *  lewat lib/auth/session.ts yang jalan di Node runtime.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get("absensi_session")?.value;

  const PUBLIK = ["/login", "/api/auth/login", "/api/auth/logout", "/api/health"];
  const sudahLogin = Boolean(token);

  if (!sudahLogin && !PUBLIK.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (sudahLogin && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Semua path kecuali aset statis
    "/((?!_next/static|_next/image|favicon.ico|uploads|models|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|map)$).*)",
  ],
};