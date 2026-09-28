/**
 * Hook runtime Next.js (fullstack-dev §7 + §13).
 *
 * `onRequestError` adalah global error handler bawaan Next 15 — kita tidak
 * butuh express-style handler sendiri. Semua error yang belum tertangani
 * route (throw di luar try/catch, crash saat render, handler yang reject)
 * sampai ke sini, lengkap dengan `requestId` yang sama dengan yang muncul
 * di log server. Ini yang menutup anti-pattern #7: "catching errors silently".
 *
 * Register() hanya jalan sekali per proses server, saat boot.
 */

import { log } from "@/lib/log";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initShutdown } = await import("@/lib/db");
    initShutdown();
  }
}

type NextRequest = {
  path: string;
  method: string;
  headers: Headers | Record<string, string | string[] | undefined>;
};

function bacaHeader(h: NextRequest["headers"], nama: string): string | undefined {
  if (h instanceof Headers) return h.get(nama) ?? undefined;
  const v = (h as Record<string, string | string[] | undefined>)[nama];
  return Array.isArray(v) ? v[0] : v;
}

export async function onRequestError(
  error: unknown,
  request: NextRequest,
  context: { routerKind?: string; routePath?: string; routeType?: string },
): Promise<void> {
  const pesan = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  log.error("request_gagal", {
    pesan,
    // stack hanya di produksi: di dev sudahShown di terminal Next.
    ...(process.env.NODE_ENV === "production" && stack ? { stack } : {}),
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routerKind: context.routerKind,
    userAgent: bacaHeader(request.headers, "user-agent")?.slice(0, 200),
  });
}
