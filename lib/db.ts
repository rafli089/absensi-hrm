import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Singleton: dev reload Next.js bikin banyak instance kalau tidak disimpan di global.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Tutup koneksi DB rapi saat proses disegarkan (fullstack-dev §13).
 *
 * Tanpa ini, `next build`/restart era menyisakan koneksi postgres yatim sampai
 * container DB kena batas `max_connections`. Query yang sedang jalan
 * dibiarkan selesai — `$disconnect()` sudah drain dengan sendirinya.
 *
 * Dipanggil sekali dari `instrumentation.ts` (Node runtime saja).
 */
export function initShutdown(): void {
  let tutup = false;
  const once = (signal: NodeJS.Signals) => {
    if (tutup) return;
    tutup = true;
    process.stderr.write(`${JSON.stringify({
      ts: new Date().toISOString(), level: "info", msg: "shutdown", signal,
    })}\n`);
    void prisma.$disconnect().finally(() => process.exit(0));
  };
  for (const s of ["SIGTERM", "SIGINT"] as const) process.once(s, once);
}
